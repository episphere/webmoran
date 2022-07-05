import { DataMap } from "./classes/DataMap2.js"
import { MoranPlot } from "./classes/MoranPlot.js"
import { GeoSpatial } from "./classes/GeoSpatial.js"
import { ColorKey } from "./classes/ColorKey.js"
import { default as geodajs } from 'https://cdn.skypack.dev/jsgeoda@0.2.3?min'


// --- ASSUMPTIONS ---
// * GeoJSON is FeatureCollection 


let radialMap = null
let dataMap = null
let moranPlot = null
let expResult = null

let colorScheme = d3.interpolateCividis

const dataConfig = document.getElementById("data-config")
dataConfig.addEventListener("click", () => {
  const content = dataConfig.nextElementSibling 
  content.style.display = content.style.display == "block" ? "none" : "block" 
})

const controlsElement = document.getElementById("controls")

// --- Populate the 'Data Configuration' collapsible form ---

let geoDataMap = new Map()
let rowDataMap = new Map()
let weightDataMap = new Map()

const fileConfigElement = document.getElementById("file-config")

const geoFilePick = createFilePick("Geography:", file => {
  const reader = new FileReader()
  function parseFile() {
    let data = null
    data = JSON.parse(reader.result)
    geoDataMap.set(file.name, data)
  }

  reader.addEventListener("load", parseFile, false);
  if (file) {
    reader.readAsText(file)
  }
})

const rowFilePick = createFilePick("<i>Row Data</i>:", file => {
  const reader = new FileReader()
  function parseFile() {
    // TODO: Add JSON parsing
    let data = null
    data = d3.csvParse(reader.result)
    geoDataMap.set(file.name, data)
  }

  reader.addEventListener("load", parseFile, false);
  if (file) {
    reader.readAsText(file)
  }
})
const idFieldSelect = createSelect("ID Field:", [], "Awaiting file...")
const weightFilePick = createFilePick("<i>Weights</i>:", file => {
  weightFileMap.set(file.name, file)
})
const subAreaFieldSelect = createSelect("<i>Sub-Area Field:</i>", [], "None")
subAreaFieldSelect.id = "select-area-field"

geoFilePick.getElementsByTagName("select")[0].addEventListener("change", e => {
  const data = geoDataMap.get(e.target.value)
  updateGeoData(data)
  updateRowData(rowData)
  //plotBaseData()
})
rowFilePick.getElementsByTagName("select")[0].addEventListener("change", e => {
  const data = rowDataMap.get(e.target.value)
  updateRowData(data)
  plotBaseData()
})

fileConfigElement.appendChild(geoFilePick)
fileConfigElement.appendChild(document.createElement("div"))

fileConfigElement.appendChild(rowFilePick)
fileConfigElement.appendChild(idFieldSelect)

fileConfigElement.appendChild(weightFilePick)
fileConfigElement.appendChild(document.createElement("div"))

fileConfigElement.appendChild(subAreaFieldSelect)

// ---

const dataControls = document.getElementById("data-controls")

const valueSelect = createSelect("Value Field:", [], "Awaiting file...")
const areaSelect = createSelect("Area:", [], "Awaiting file...")
dataControls.appendChild(valueSelect)
dataControls.appendChild(areaSelect)

// ---

let idField = null
let vField = null 
let subAreaField = null 
let areaValue = null

let dataMapPlot = null 

let geoData = null
let rowData = null



async function updateGeoData(data, vField = null) {
  // TODO: Smart fields. 
  
  geoData = data

  if (rowData) {
    addFeatureProperties(geoData.features, rowData, idField)
  }

}

async function updateRowData(data) {
  // TODO: This assumes all rows have the same properties, fix this.

  if (data == null) {
    return
  }

  rowData = data 

  addFeatureProperties(geoData.features, rowData, idField)

  const idSelect = idFieldSelect.getElementsByTagName("select")[0]
  let optionSelected = false 
  for (const field of Object.keys(rowData[0])) {
    if (field == idField) {
      optionSelected = true 
    }
    addOption(idSelect, field, field == idField)
  }

  if (!optionSelected) {
    // TODO: Smart default
    select.getElementsByTagName("option")[1].setAttribute("selected", "")
  }

  const valueSelectElem = valueSelect.getElementsByTagName("select")[0]
  optionSelected = false 
  for (const field of Object.keys(rowData[0])) {
    if (field == vField) {
      optionSelected = true 
    }
    addOption(valueSelectElem, field, field == vField)
  }

  if (!optionSelected) {
    // TODO: Smart default
    valueSelectElem.getElementsByTagName("option")[1].setAttribute("selected", "")
  }

  const subAreaSelect = subAreaFieldSelect.getElementsByTagName("select")[0]
  for (const field of Object.keys(rowData[0])) {
    addOption(subAreaSelect, field, field == subAreaField)
  }

  if (subAreaSelect.value != "None") {
    const areaSelectElem = areaSelect.getElementsByTagName("select")[0]
    const areaValues = new Set(rowData.map(d => d[subAreaField]))
    addOption(areaSelectElem, "All")
    optionSelected = false 
    for (const value of areaValues) {
      const isSelected = areaValue == value
      if (isSelected) {
        optionSelected = true
      }
      addOption(areaSelectElem, value, isSelected)
    }
    if (!optionSelected) {
      areaSelectElem.getElementsByTagName("option")[1].setAttribute("selected", "")
    }
    //areaSelect.
  }
  
}

function uploadGeoFile(file) {
  
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

function uploadWeightFile(file) {
  const reader = new FileReader()
  function parseFile() {
    const map = new Map()
    const rowStrArr = reader.result.split('\n')
    for (let i = 1; i < rowStrArr.length; i++) {
      const row = rowStrArr[i].split(/\s+/)
      let weights = map.get(row[0])
      if (!weights) {
        weights = new Map()
        map.set(row[0], weights)
      }
      weights.set(row[1], parseFloat(row[2]))
    }
    weightMap = map
    weightMethodSelectLabel = file.name
  }

  reader.addEventListener("load", parseFile, false);
  if (file) {
    reader.readAsText(file)
  }
}

// Plot the unprocessed data
async function plotBaseData(update) {
  for (const feature of geoData.features) { 
    feature.properties[vField] = parseFloat(feature.properties[vField])
  }

  let geoDataFilter = null 
  if (areaValue == "All" || !areaValue) {
    geoDataFilter = geoData
  } else {
    geoDataFilter = {
      type: "FeatureCollection", 
      features: geoData.features.filter(feature => feature.properties[subAreaField] == areaValue)
    }
  }

  console.log(geoData, geoDataFilter)
  if (!update) {
    const mapElement = document.getElementById("plot-datamap")
    dataMap = new DataMap(mapElement, geoDataFilter, vField, { 
        areaName: "county", numberFormat: d => d.toFixed(3), width:400, height:400,
      })
  } else {
    dataMap.dataUpdated()
  }
  
}

async function updateBaseData() {
  dataMap.dataUpdated()
}

function start() {
  vField = "adult_smoking"
  idField = "fipscode"
  subAreaField = "state"
  areaValue = "VA"

  const geoSelect = geoFilePick.getElementsByTagName("select")[0]
  d3.json("data/us_topology_county.geojson").then(geoData => {
    addOption(geoSelect, "us_topology_county.geojson", true)
    geoDataMap.set("us_topology_county.geojson", geoData)
    geoSelect.dispatchEvent(new Event("change"))
  })
 
  const rowSelect = rowFilePick.getElementsByTagName("select")[0]
  d3.csv("data/chr_data_2022.csv").then(rowData => {
    addOption(rowSelect, "chr_data_2022.csv", true)
    rowDataMap.set("chr_data_2022.csv", rowData)
    rowSelect.dispatchEvent(new Event("change"))
  })

  //addOption(geoSelect, "us_topology_states.geojson", false)

  // d3.json("data/us_topology_county.geojson").then(geoData => {
  //   updateGeoData(geoData)
  //   plotBaseData(geoData)
  // }).then(d3.csv("data/chr_data.csv").then(rowData => {
  //   updateRowData(rowData)
  // }))
}


start()


// -------

function shorten(str, n) {
  return str.length < n ? str : str.slice(0, n) + "..."
}

function addOption(select, field, selected=false) {
  const option = document.createElement("option")
  option.setAttribute("value", field)
  option.innerHTML = field
  if (selected) {
    option.setAttribute("selected", "")
  }
  select.appendChild(option)
}

function clearSelect(select, clearPlaceholder=false) {
  const placeholder = [...select.getElementsByClassName("ginput-select-default")][0]
  select.innerHTML = ""
  select.appendChild(placeholder)
}


function createSelect(labelText, options=[], placeholderText=null) {
  const mainDiv = document.createElement("div")
  mainDiv.classList.add("ginput-select")

  const label = document.createElement("label")
  label.innerHTML = labelText 

  const select = document.createElement("select")

  if (placeholderText) {
    const defaultOption = document.createElement("option")
    defaultOption.classList.add("ginput-select-default")
    defaultOption.innerHTML = placeholderText
    defaultOption.setAttribute("disabled", "")
    defaultOption.setAttribute("hidden", "")
    defaultOption.setAttribute("selected", "")
    select.appendChild(defaultOption)
  }

  for (const [str, value] of options) {
    const option = document.createElement("option")
    option.innerHTML = str
    select.appendChild(option)
  }

  mainDiv.append(label)
  mainDiv.append(select)
  
  return mainDiv
}

function createFilePick(labelText, parser) {
  const mainDiv = document.createElement("div")
  mainDiv.classList.add("ginput-file")

  const label = document.createElement("label")
  label.innerHTML = labelText 

  const select = document.createElement("select")
  const defaultOption = document.createElement("option")
  defaultOption.classList.add("ginput-select-default")
  defaultOption.innerHTML = "Upload a file..."
  defaultOption.setAttribute("disabled", "")
  defaultOption.setAttribute("hidden", "")
  defaultOption.setAttribute("selected", "")
  select.appendChild(defaultOption)

  const fileInput = document.createElement("input")
  fileInput.setAttribute("type", "file")
  fileInput.style.display = "none"
  fileInput.addEventListener("change", e => {
    const file = e.target.files[0]
    const fileOption = document.createElement("option")
    fileOption.innerHTML = file.name
    fileOption.value = file.name
    parser(file)
    select.appendChild(fileOption)
    fileOption.setAttribute("selected", "")
  })

  const uploadButton = document.createElement("button")
  uploadButton.innerHTML = `<span class="material-icons">file_upload</span>`
  uploadButton.addEventListener("click", e => {
    fileInput.click()
    //document.getElementById("test").click()
  })

  mainDiv.append(label)
  mainDiv.append(fileInput)
  mainDiv.append(select)
  mainDiv.append(uploadButton)
  
  //element.appendChild(mainDiv)
  return mainDiv//element
}

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
