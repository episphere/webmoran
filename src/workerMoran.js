import * as geo from "./geospatial.js"

self.addEventListener("message", function(e) {
  const {moranResult, weightMatrix, permutations} = {...e.data}

  console.log("Calculating p values...")
  
  geo.calculatePValues(moranResult, weightMatrix, {
    progressCallback: p => {
      self.postMessage({moranResult: moranResult, progress: p})
    },
    permutations: permutations
  })

})