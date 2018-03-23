const pcbStackup = require("pcb-stackup");
const superagent = require("superagent");
const jszip = require("jszip");

function pcbStackupZip(url, options) {
  options = options || {};
  // you can use your own style in the color field or solderMask, silkScreen and copperFinish
  options.color = options.color || getColors(options);
  // pcb-stackup will fill gaps in the outline but is a bit too strict by
  // default in my experience, the units are currently the gerber units but
  // will always be in mm when pcb-stackup is updated to 4.0.0
  options.outlineGapFill = options.outlineGapFill || 0.05;
  return superagent
    .get(url)
    .set("accept", "application/zip")
    .responseType("blob")
    .buffer()
    .then(r => r.body)
    .then(jszip.loadAsync)
    .then(zip => {
      const files = [];
      zip.forEach((path, file) => {
        if (!file.dir) {
          files.push(
            file
              .async("text")
              .then(contents => ({ gerber: contents, filename: path }))
          );
        }
      });
      return Promise.all(files);
    })
    .then(
      layers =>
        new Promise((resolve, reject) => {
          pcbStackup(layers, options, (err, stackup) => {
            if (err) {
              return reject(err);
            }
            let board_width = stackup.top.width;
            let board_length = stackup.top.height;
            // Convert to mm
            if (stackup.top.units == "in") {
              board_width = board_width * 25.4;
              board_length = board_length * 25.4;
            }
            const board_layers = countLayers(stackup.layers, [
              "icu",
              "bcu",
              "tcu",
            ]);
            return resolve({
              board_width,
              board_length,
              board_layers,
              stackup,
            });
          });
        })
    );
}

const colorMap = {
  copperFinish: {
    bare: "#C87533",
    gold: "goldenrod",
    nickel: "whitesmoke",
    hasl: "silver",
  },
  solderMask: {
    red: "rgba(139, 0, 0, 0.90)",
    orange: "rgba(195, 107, 0, 0.90)",
    yellow: "rgba(255, 255, 102, 0.50)",
    green: "rgba(0, 68, 0, 0.90)",
    blue: "rgba(0, 30, 104, 0.90)",
    purple: "rgba(46, 0, 81, 0.90)",
    black: "rgba(0, 0, 0, 0.90)",
    white: "rgba(255, 255, 255, 0.90)",
  },
  silkScreen: {
    red: "red",
    yellow: "yellow",
    green: "green",
    blue: "blue",
    black: "black",
    white: "white",
  },
};

// turn color options into a pcb stackup color options
function getColors(options) {
  const colors = {
    solderMask: colorMap.solderMask.green,
    silkScreen: colorMap.silkScreen.white,
    copperFinish: colorMap.copperFinish.hasl,
  };
  if (options.solderMask != null) {
    colors.solderMask = colorMap.solderMask[options.solderMask];
  }
  if (options.silkScreen != null) {
    colors.silkScreen = colorMap.silkScreen[options.silkScreen];
  }
  if (options.copperFinish != null) {
    colors.copperFinish = colorMap.copperFinish[options.copperFinish];
  }
  return {
    fr4: "#4D542C",
    cu: "lightgrey",
    cf: colors.copperFinish,
    sm: colors.solderMask,
    ss: colors.silkScreen,
    sp: "rgba(0, 0, 0, 0.0)",
    out: "black",
  };
}

// A function to count the layers of a specific type
function countLayers(layers, types) {
  let count = 0;
  layers.forEach(layer => {
    if (types.indexOf(layer.type) > -1) {
      count++;
    }
  });
  return count;
}

module.exports = pcbStackupZip;
