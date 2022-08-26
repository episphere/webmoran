import * as geo from "./geospatial.js"

self.addEventListener("message", function(e) {
  const {moranResult, weightMatrix, permutations} = {...e.data}
  
  geo.calculatePValues(moranResult, weightMatrix, {
    progressCallback: p => {
      self.postMessage({moranResult: moranResult, progress: p})
    },
    permutations: permutations
  })

})