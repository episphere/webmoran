import { DataMap } from "./classes/DataMap.js"
import { MoranPlot } from "./classes/MoranPlot.js"
import { GeoSpatial } from "./classes/GeoSpatial.js"
import { ColorKey } from "./classes/ColorKey.js"
import { default as geodajs } from 'https://cdn.skypack.dev/jsgeoda@0.2.3?min'


// --- ASSUMPTIONS ---
// * GeoJSON is FeatureCollection 

let radialMap = null
let dataMap = null
let moranPlot = null
let moranResult = null

const dataConfig = document.getElementById("data-config")
dataConfig.addEventListener("click", () => {
  const content = dataConfig.nextElementSibling // TODO: I don't like this.
  content.style.display = content.style.display == "block" ? "none" : "block" 
})

const controlsElement = document.getElementById("controls")
controlsElement.appendChild(createRadioSelect([
  {value: "moran", label: "Moran [z]"},
  {value: "significance", label: "Significance [x]"}, 
  {value: "cluster", label: "Cluster [c]"},
  {value: "value", label: "Value [v]", checked: true}, 
], "mode", "Color Mode: "))

const radialCheckDiv = document.createElement("span")
radialCheckDiv.setAttribute("class", "check")
radialCheckDiv.setAttribute("id", "radial-check-div")
const radialCheck = document.createElement("input")
radialCheck.setAttribute("id", "radial-check")
radialCheck.setAttribute("type", "checkbox")
radialCheck.setAttribute("checked", "")
radialCheck.addEventListener("click", () => {
  moranPlot.radialMap = radialCheck.checked ? radialMap : null
})
const radialLabel = document.createElement("label")
radialLabel.innerHTML = "Radial Plot"
radialLabel.setAttribute("for", "radial-check")
radialLabel.setAttribute("style", "margin-left: 3px")
radialCheckDiv.appendChild(radialCheck)
radialCheckDiv.appendChild(radialLabel)
controlsElement.appendChild(radialCheckDiv)


document.getElementById("radio-mode-cluster").addEventListener("click", 
  () => setMode("cluster"))
document.getElementById("radio-mode-value").addEventListener("click", 
  () => setMode("value"))
document.getElementById("radio-mode-significance").addEventListener("click", 
  () => setMode("significance"))
document.getElementById("radio-mode-moran").addEventListener("click", 
  () => setMode("moran"))

// ---

// TODO: Area name field select

let urlAddress = null
const geoDataSelectLabel = document.getElementById("geo-data-select-label")
geoDataSelectLabel.innerHTML = "None"
const rowDataSelectLabel = document.getElementById("row-data-select-label")
rowDataSelectLabel.innerHTML = "None"

const idFieldSelect = document.getElementById("idfield-select")
const vFieldSelect = document.getElementById("vfield-select")

const runButton = document.getElementById("run-button")

const colorElement = document.getElementById("plot-key")

let vField = null

let geoData = null
let rowData = null

let filename = null
async function updateGeoData(data, vField = null) {
  // TODO: Smart fields. 
  geoData = data

  let fields = new Set()
  data.features.forEach(d => {
    Object.keys(d.properties).forEach(field => {
      fields.add(field)
    })
  })

  fields = [...fields]
  fields.forEach(d => addOption(vFieldSelect, d))

  if (vField) {
    vFieldSelect.value = vField
  }

}

function updateRowData(data) {
  // TODO: Smart fields. 
  rowData = data

  const fields = Object.keys(data[0])
  fields.forEach(d => addOption(vFieldSelect, d))
  fields.forEach(d => addOption(idFieldSelect, d))
}

function shorten(str, n) {
  return str.length < n ? str : str.slice(0, n) + "..."
}

function uploadGeoFile(file) {
  const reader = new FileReader()
  function parseFile() {
    let data = null
    data = JSON.parse(reader.result)
    updateGeoData(data)
    geoDataSelectLabel.innerHTML = shorten(file.name, 15)
    filename = file.name
    urlAddress = null
  }

  reader.addEventListener("load", parseFile, false);
  if (file) {
    reader.readAsText(file)
  }
}

function uploadRowFile(file) {
  const reader = new FileReader()
  function parseFile() {
    let data = null
    data = d3.csvParse(reader.result)
    updateRowData(data)
    rowDataSelectLabel.innerHTML = shorten(file.name, 15)
    filename = file.name
    urlAddress = null
  }

  reader.addEventListener("load", parseFile, false);
  if (file) {
    reader.readAsText(file)
  }
}

function addOption(select, field) {
  const option = document.createElement("option")
  option.setAttribute("value", field)
  option.innerHTML = field
  select.appendChild(option)
}

let colorScale = null


async function runData(geoData, rowData) {
  if (rowData) {
    addFeatureProperties(geoData.features, rowData, idFieldSelect.value)
  }  
  
  // TODO: Better z-score calculation
  vField = vFieldSelect.value 
  for (const feature of geoData.features) {
    feature.properties.feature = parseFloat(feature.properties[vField])
  }
  const mean = d3.mean(geoData.features, d => d.properties[vField])
  for (const feature of geoData.features) {
    feature.properties.z = feature.properties[vField] - mean
  }

  const valueExtent = d3.extent(geoData.features.filter(
    d => !isNaN(parseFloat(d.properties[vField]))), d => d.properties[vField])
  colorScale = d3.scaleSequential(d3.interpolateCividis)
    .domain(valueExtent)

  const geoda = await geodajs.New()
  const geoSpatial = new GeoSpatial(geoData, {geoda: geoda})
  moranResult = geoSpatial.moran(vField)
  radialMap = geoSpatial.localMoranRadials(moranResult)

  const mapElement = document.getElementById("plot-datamap")
  dataMap = new DataMap(mapElement, geoData, vField, 
    { 
      areaName: "county",
      numberFormat: d => d.toFixed(5), colorScale: colorScale, width:400, height:400,
    })

  const moranElement = document.getElementById("plot-moran")
  moranPlot = new MoranPlot(moranElement, moranResult,
    {state: dataMap.state, numberFormat: d => d.toFixed(5), 
      fixedColorScale: colorScale, radialMap: radialMap,
      width:400, height:400, margin: {left:40, right:50, bottom:30, top:30}})
  
  let title = vField
  if (title.length >= 17) {
    title = title.slice(0, 13) + "..."
  }
  new ColorKey(colorElement, colorScale, "continuous", 
    {width:95,  title: title, margin:{left: 30, right: 45, top: 10, bottom: 10,}})
}

document.getElementById("geo-data-select").addEventListener("change", e => {
  const file = e.target.files[0]
  uploadGeoFile(file)
})

document.getElementById("row-data-select").addEventListener("change", e => {
  const file = e.target.files[0]
  uploadRowFile(file)
})

runButton.addEventListener("click", () => {
  runData(geoData, rowData)
})

d3.json("data/vi_props.json").then(d => {
  // TODO: Remove
  for (const feature of d.features.slice(0,8)) {
    delete feature.properties["% Adult smoking"]
  }

  geoDataSelectLabel.innerHTML = shorten("CHR 2021.csv", 15)
  updateGeoData(d, "% Adult smoking")
  runData(d)
}) 

document.addEventListener('keydown', keyDown)

const clusterColorScale = d3.scaleOrdinal(
  ["Not significant", "High-High", "Low-Low", "Low-High", "High-Low"],
  ['#eeeeee', '#FF0000', '#0000FF', '#a7adf9', '#f4ada8'])

const clusterColorFunction = d => {
  return clusterColorScale(d.label)
}

const pColorScale = d3.scaleOrdinal(
  [0.05, 0.01, 0.001, 0.0001],
  Array.from({length: 4}, (_, i) => d3.interpolateGreens((i+1)/5)))

const pColorFunction = d => {
  return d.pCutoff ? pColorScale(d.pCutoff) : "whitesmoke"
}


function setMode(mode) {
  if (mode == "cluster") {
    document.getElementById("radio-mode-cluster").checked = true

    dataMap.setVField("label")
    moranPlot.setColorField("label")
    dataMap.setFillColorFunction(clusterColorFunction)
    moranPlot.setFillColorFunction(clusterColorFunction)

    new ColorKey(colorElement, clusterColorScale, "categorical",
      {width:95, title: "Cluster", margin:{left: 30, right: 45, top: 10, bottom: 10}})
  } else if (mode == "significance") {
    document.getElementById("radio-mode-significance").checked = true

    dataMap.setVField("p")
    moranPlot.setColorField("p")
    dataMap.setFillColorFunction(pColorFunction)
    moranPlot.setFillColorFunction(pColorFunction)

    new ColorKey(colorElement, pColorScale, "categorical",
      {width:95, title: "Pseudo p", margin:{left: 30, right: 45, top: 10, bottom: 10}})
  } else if (mode == "moran") {
    document.getElementById("radio-mode-moran").checked = true

    colorScale.interpolator(d3.interpolateRdBu)
    dataMap.setVField("localMoran", false, true)
    moranPlot.setColorField("localMoran")
    dataMap.setFillColorFunction(null)
    moranPlot.setFillColorFunction(null)

    new ColorKey(colorElement, colorScale, "continuous", 
      {width:95,  title: "Local Moran's I", margin:{left: 30, right: 45, top: 10, bottom: 10}})
  } else if (mode == "value") {
    document.getElementById("radio-mode-value").checked = true

    colorScale.interpolator(d3.interpolateCividis)
    dataMap.setVField(vField)
    moranPlot.setColorField("raw")
    dataMap.setFillColorFunction(null)
    moranPlot.setFillColorFunction(null)

    let title = vField
    if (title.length >= 17) {
      title = title.slice(0, 13) + "..."
    }

    new ColorKey(colorElement, colorScale, "continuous", 
      {width:95,  title: title, margin:{left: 30, right: 45, top: 10, bottom: 10}})
  }
}

const mode = "default"
function keyDown(e) {
  if (e.target != document.body) {
    return
  }

  if (e.code == "KeyC") {
    setMode("cluster")
  } else if (e.code == "KeyX" ) {
    setMode("significance")
  } else if (e.code == "KeyV" ) {
    setMode("value")
  } else if (e.code == "KeyZ") {
    setMode("moran")
  }
}

// -------

function addFeatureProperties(features, propertyRows, idField) {
  const rowMap = new Map(propertyRows.map(d => [d[idField], d]))
  features.forEach(feature => {
    const row = rowMap.get(feature.id)
    if (row) {
      for (const [k, v] of Object.entries(row)) {
        feature.properties[k] = v
      }
    }
  })
  return features
}

function createRadioSelect(options, name, title = null) {
  const div = document.createElement("div")

  if (title != null) {
    const titleSpan = document.createElement("span")
    titleSpan.innerHTML = `<b>${title}</b>`
    div.appendChild(titleSpan)
  }
  
  div.setAttribute("class", "radio-select")

  for (const option of options) {
    const label = document.createElement("label")
    label.setAttribute("for", `radio-${name}-${option.value}`)
    label.innerHTML = option.label
    
    const input = document.createElement("input")
    input.setAttribute("id", `radio-${name}-${option.value}`)
    input.setAttribute("value", option.value)
    input.setAttribute("type", "radio")
    input.setAttribute("name", name)
    if (option.checked) {
      input.setAttribute("checked", "")
    }
   
    div.appendChild(input)
    div.appendChild(label)
  }

  return div
}