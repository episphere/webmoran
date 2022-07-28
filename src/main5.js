
import { DataMap } from "./classes/DataMap2.js"
import { MoranPlot } from "./classes/MoranPlot2.js"

import * as geo from "./geospatial.js"

// Basic input components

class Select {
  constructor(props, element) {
    props = {
      values: [],
      handleChange: () => null, 
      placeholderText: "<span style='color:grey'>No values...</span>",
      active: true, 
      disabled: false,
      ...props
    }

    this.values = props.values 
    this.value = props.value ? props.value : props.values[0]
    this.handleChange = props.handleChange
    this.placeholderText = props.placeholderText
    this.defaultValue = props.defaultValue
    this.active = props.active
    this.disabled = props.disabled

    this.element = element 
    this.select = document.createElement("select")
    if (this.disabled) {
      this.select.setAttribute("disabled", "")
    }
    this.select.addEventListener("change", e => {
      this.value = this.select.value
      this.handleChange(this.select.value)
    })

    this.updateValues(this.values, this.value, false)
    this.element.appendChild(this.select)
  }

  updateValues(values, defaultValue = null, trigger = true) {

    this.values = values 
    this.select.innerHTML = ""

    if (this.values.length == 0 && this.placeholderText != null) {
      const option = document.createElement("option")
      option.innerHTML = this.placeholderText
      option.value = null
      this.select.appendChild(option)
      option.setAttribute("disabled", "")
      option.setAttribute("hidden", "")
      option.setAttribute("selected", "")
    }
    
    for (let value of values) {

      if (!Array.isArray(value)) {
        value = [value, value]
      }

      const option = document.createElement("option")
      option.innerHTML = value[1]  
      option.value = value[0]
      if (value[0] == defaultValue || (defaultValue == null && value[0] == this.defaultValue)) {
        option.setAttribute("selected", "")
      }
      this.select.appendChild(option)
    }

    if (trigger && this.active) {
      let event = new Event("change")
      this.select.dispatchEvent(event)
    }

    this.value = this.select.value
  }

  clear() {
    this.updateValues([])
  }

  setDisabled(disabled) {
    this.disabled = disabled 
    if (disabled) {
      this.select.setAttribute("disabled", "")
    } else {
      this.select.removeAttribute("disabled")
    }
  }
}

class RadioSelect {
  constructor(props, element) {
    props = {
      name: "radio-select",
      values: [],
      handleChange: () => null, 
      ...props
    }

    this.name = props.name
    this.values = props.values 
    this.value = props.value ? props.value : props.values[0]
    this.handleChange = props.handleChange

    this.element = element 
    this.div = document.createElement("div")

    this.updateValues(this.values, this.value, false)
    this.element.appendChild(this.div)
  }

  updateValues(values, defaultValue = null, trigger = true) {

    this.values = values 
    this.div.innerHTML = ""
    
    this.value = null
    for (let value of values) {

      if (!Array.isArray(value)) {
        value = [value, value]
      }

      const id = `radio-${this.name}-${value}`

      const label = document.createElement("label")
      label.setAttribute("for", id)
      label.innerHTML = value[1]

      const input = document.createElement("input")
      input.setAttribute("id", id)
      input.setAttribute("type", "radio")
      input.setAttribute("value", value[0])
      input.setAttribute("name", this.name)
      if (value[0] == defaultValue) {
        input.setAttribute("checked", "")
        this.value = value[0]
      }
      input.addEventListener("click", e => {
        this.value = e.target.value
        this.handleChange(this.value)
      })
      
      this.div.appendChild(label)
      this.div.appendChild(input)
    }


  }
}

class FileSelect {
  constructor(props, element) {
    props = {
      handleChange: () => null, 
      defaultFileDataWrappers: [],
      parse: d => d,
      placeholderText: "<span style='color:grey'>Awaiting file...</span>",
      disabled: false,
      ...props
    }

    this.handleChange = props.handleChange
    this.parse = props.parse
    this.fileMap = new Map(props.defaultFileDataWrappers.map(d => [d.name, d.data]))
    this.disabled = props.disabled
    this.element = element 

    this.handleSelectChange = this.handleSelectChange.bind(this)

    this.select = new Select({
      values: [...this.fileMap.keys()], handleChange: this.handleSelectChange, 
      disabled: this.disabled, placeholderText: props.placeholderText
    }, element)

    const fileWrapper = {name: this.select.value, data: this.fileMap.get(this.select.value)}
    this.value = fileWrapper 

    const fileInput = document.createElement("input")
    fileInput.setAttribute("type", "file")
    fileInput.style.display = "none"
    fileInput.addEventListener("change", e => {
      const file = e.target.files[0]
      this.handleFileUpload(file)
      fileInput.value = "" 
    })

    this.button = document.createElement("button")
    this.button.innerHTML = "Upload"
    this.button.addEventListener("click", () => fileInput.click())
    if (this.disabled) {
      this.button.setAttribute("disabled", "")
    }

    element.appendChild(this.button)
  }

  handleFileUpload(file) {
    this.readFile(file).then(e => {
      const data = this.parse(e.currentTarget.result)
      this.fileMap.set(file.name, data)
      this.select.updateValues([...this.fileMap.keys()], file.name)
    })
  }

  handleSelectChange(value) {
    const fileWrapper = {name: value, data: this.fileMap.get(value)}
    this.value = fileWrapper 
    this.handleChange(fileWrapper)
  }

  clear() { 
    this.fileMap.clear()
    this.select.clear()
  }

  setDisabled(disabled) {
    this.disabled = disabled 
    if (disabled) {
      this.button.setAttribute("disabled", "")
    } else {
      this.button.removeAttribute("disabled")
    }
    this.select.setDisabled(disabled)
  }

  async readFile(file) {
    const reader = new FileReader()
    return new Promise((resolve, reject) => {
      function read(e) {
        resolve(e)
      }

      reader.addEventListener("load", read, false)
      if (file) {
        reader.readAsText(file)
      }
    })
  }
}

class DataFileManager {
  constructor(dataProcessedCallback) {
    this.dataProcessedCallback = dataProcessedCallback

    this.handleGeoChange = this.handleGeoChange.bind(this)
    this.handleRowChange = this.handleRowChange.bind(this)
    this.handleIdFieldChange = this.handleIdFieldChange.bind(this)

    Promise.all([
      d3.json("data/us_topology_county.geojson"), 
      d3.json("data/us_topology_state.geojson"),
      d3.csv("data/chr_data_2022_small.csv")
    ]).then((datas) => {
      const [geoDataCounty, geoDataState, rowData] = datas

      this.geoFileSelect = new FileSelect({
        defaultFileDataWrappers: [
          {name: "us_topology_county.json", data: geoDataCounty},
          {name: "us_topology_state.geojson", data: geoDataState},
        ],
        handleChange: this.handleGeoChange
      }, document.getElementById("geo-file-pick"))
      this.geoData = this.geoFileSelect.value.data
      
      this.rowFileSelect = new FileSelect({
        defaultFileDataWrappers: [
          {name: "chr_data_2022_small.csv", data: rowData},
        ],
        handleChange: this.handleRowChange,
        parse: d3.csvParse,
      }, document.getElementById("row-file-pick"))
      
      this.idFieldSelect = new Select({
        values: [], handleChange: this.handleIdFieldChange, defaultValue: "fipscode",
      }, document.getElementById("id-field-select"))

      this.handleRowChange(this.rowFileSelect.value)
    })

   
  }

  handleGeoChange(value) {
    this.geoData = value.data 
    this.rowFileSelect.clear()
  }
  
  handleRowChange(value) {
    this.rowData = value.data 

    if (!this.rowData) {
      this.rowData = []
    }

    const fields = new Set()
    this.rowData.forEach(row => {
      for (const field of Object.keys(row)) {
        fields.add(field)
      }
    })

    this.idFieldSelect.updateValues([...fields])
  }
  
  handleIdFieldChange(value) {
    this.processData()
  }

  processData() {

    const geoDataFeatures = this.geoData.features.map(feature => ({
      ...feature,
      properties: {...feature.properties},
    }))

    this.addFeatureProperties(geoDataFeatures, this.rowData, this.idFieldSelect.value)

    this.dataProcessedCallback({
      type: "FeatureCollection",
      features: geoDataFeatures
    })
  }

  addFeatureProperties(features, propertyRows, idField) {
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
}

class DataDetailsManager {
  constructor(props) {
    props = {
      data: {type: "FeatureCollection", features: []},
      usedFields: [],
      callback: d => d,
      ...props,
    }

    this.data = props.data
    this.usedFields = props.usedFields
    this.callback = props.callback

    this.handleChange = this.handleChange.bind(this)


    this.subAreaFieldSelect = new Select({
      values: [], handleChange: this.handleChange, defaultValue: "state", //active: false, 
    }, document.getElementById("subarea-field-select"))

    this.subAreaSelect = new Select({
      values: [], handleChange: this.handleChange, defaultValue: "VA", //active: false 
    }, document.getElementById("subarea-select"))
    
    this.valueFieldSelect = new Select({
      values: [], handleChange: this.handleChange, defaultValue: "adult_smoking", //active: false
    }, document.getElementById("value-field-select"))



    //this.updateData(this.data, false)
  }

  handleChange() {
    this.valueField = this.valueFieldSelect.value 
    this.subAreaField = this.subAreaFieldSelect.value 
    this.subArea = this.subAreaSelect.value

    this.updateData(this.data)
  }


  updateData(data, trigger = true) {
    this.data = data

    const fields = new Set()
    for (const feature of this.data.features) {
      for (const field of Object.keys(feature.properties)) {
        fields.add(field)
      }
    }

    this.valueFieldSelect.updateValues([...fields], this.valueField, false)
    this.subAreaFieldSelect.updateValues([...fields], this.subAreaField, false)

    this.valueField = this.valueFieldSelect.value 
    this.subAreaField = this.subAreaFieldSelect.value 

    const areas = new Set()
    for (const feature of this.data.features) {
      const area = feature.properties[this.subAreaField]
      if (area) {
        areas.add(area)
      }
    }

    this.subAreaSelect.updateValues([...areas], this.subArea, false)
    this.subArea = this.subAreaSelect.value

    this.processData()
  }

  processData() {

    let features = this.data.features.filter(
      feature => feature.properties[this.subAreaField] == this.subArea)
    
    features = features.map(feature => ({
      ...feature,
      properties: feature.properties,

    }))

    features.forEach(feature => {
      feature.properties[this.valueField] = parseFloat(feature.properties[this.valueField])
    })

    this.callback({
      type: "FeatureCollection",
      features: features
    }, this.valueField)
  }

}

class WeightManager {
  constructor(callback) {
    this.callback = callback

    this.handleChange = this.handleChange.bind(this)

    this.weightMethodSelect = new Select({
      values: ["Rook", "Queen", "File"], handleChange: this.handleChange,
    }, document.getElementById("weight-method-select"))

    this.weightFileSelect = new FileSelect({
      handleChange: this.handleFileChange,
      disabled: true,
    }, document.getElementById("weight-file-pick"))

    this.handleChange(this.weightMethodSelect.value)
    //geo.calculateWeightMatrix
  }

  handleChange(value) {
    this.method = value
    if (this.method == "File") {
      this.weightFileSelect.setDisabled(false)
    } else {
      this.weightFileSelect.setDisabled(true)
    }
  }

  calculateWeights(data) {
    let weightMatrix = null
    if (this.method == "Rook" || this.method == "Queen") {
      weightMatrix = geo.calculateWeightMatrix(data, this.method)
    } else {
      // TODO: Weight file to weights
    }
    
    this.callback(weightMatrix, data)
  }

  handleFileChange(value) {
    // TODO: Implement weight files
  }
}

class CalculationManager {
  constructor(initialCallback, finalCallback) {
    this.initialCallback = initialCallback 
    this.finalCallback = finalCallback
  }

  calculate(data, vField, weightMatrix) {
    geo.calculateMoran(data.features, vField, weightMatrix).then(result => {
      this.initialCallback(result)
      geo.calculatePValues(result, 999).then(result => {
        this.finalCallback(result)
      })
    })
    
  }
}

class WebMoran {
  constructor() {
    this.handleWeightChange = this.handleWeightChange.bind(this)
    this.handleInitialResults = this.handleInitialResults.bind(this)
    this.handleFinalResults = this.handleFinalResults.bind(this)
    this.handleSchemeChange = this.handleSchemeChange.bind(this)
    this.handleModeSelect = this.handleModeSelect.bind(this)

    this.weightManager = new WeightManager(this.handleWeightChange)
    this.calculationManager = new CalculationManager(this.handleInitialResults, this.handleFinalResults)

    this.colorSchemeSelect = new Select({
      values: [], handleChange: this.handleSchemeChange, defaultValue: "Reds", 
    }, document.getElementById("color-scheme-select"))

    const clusterColorScale = d3.scaleOrdinal(
      ["Not significant", "High-High", "Low-Low", "Low-High", "High-Low"],
      ['#eeeeee', '#FF0000', '#0000FF', '#a7adf9', '#f4ada8'])
    this.clusterColorFunction = d => {
      return clusterColorScale(d.label)
    }

    this.modeSelect = new RadioSelect({
      values: [
        ["moran", "Moran [z]"],
        ["significance", "Significance [x]"],
        ["cluster", "Cluster [c]"],
        ["value", "Value [v]"]
      ],
      handleChange: this.handleModeSelect,
      value: "value"
    }, document.getElementById("color-mode-radio"))

    d3.json("data/colorSchemes.json").then(schemes => {
      this.colorSchemeSelect.updateValues(schemes.map(d => [d[1], d[0]]), "Reds")

      this.modeMap = new Map([
        ["value", {field: d => this.vField, scheme: this.colorScheme, colorFunction: null}],
        ["moran", {field: "localMoran", scheme: null, colorFunction: this.clusterColorFunction, center: true}],
        ["cluster", {field: "label", scheme: null, colorFunction: this.clusterColorFunction, center: true}]
      ])
    })


  }

  updateDataDetails(data, vField) {
    this.data = data
    this.vField = vField
    this.weightManager.calculateWeights(data)
  }

  handleWeightChange(weightMarix) {
    this.weightMatrix = weightMarix
    this.calculationManager.calculate(this.data, this.vField, this.weightMatrix)
  }

  handleInitialResults(moranResult) {

    this.localResultMap = new Map(moranResult.localMorans.map(d => [d.id, d]))
    for (const feature of this.data.features) {
      const localResult = this.localResultMap.get(feature.id)
      if (localResult) {
        feature.properties.localMoran = localResult.localMoran
      } 
    }

    const mapElement = document.getElementById("plot-datamap")
    this.dataMap = new DataMap(mapElement, this.data, this.vField, {
      colorScheme: this.colorScheme, width: 400, height: 400
    })

    const moranElement = document.getElementById("plot-moran")
    this.moranPlot = new MoranPlot(moranElement, moranResult, {
      colorField: this.vField,
      colorScheme: this.colorScheme, state: this.dataMap.state,
      width: 400, height: 400, numberFormat: d => d.toFixed(2)
    })
  }

  handleFinalResults(moranResult) {
    for (const feature of this.data.features) {
      const localResult = this.localResultMap.get(feature.id)
      if (localResult) {
        feature.properties.p = localResult.p
        feature.properties.label = localResult.label
      } 
    }
  }

  handleSchemeChange(scheme) {
    this.colorScheme = d3["interpolate" + scheme]

    if (!this.dataMap || !this.moranPlot) {
      return
    }

    this.dataMap.setColorScheme(this.colorScheme)
    this.moranPlot.setColorScheme(this.colorScheme)
  }

  handleModeSelect(mode) {
    const modeDetails = this.modeMap.get(mode)

    const vField = typeof modeDetails.field == "function"  ? modeDetails.field() : modeDetails.field
    console.log("Mode: ", mode, modeDetails, vField)

    this.dataMap.setVField(vField, false, modeDetails.center)
    this.dataMap.setColorScheme(modeDetails.scheme)
    this.dataMap.setFillColorFunction(modeDetails.colorFunction)

    this.moranPlot.setColorField(vField)
    this.moranPlot.setColorScheme(modeDetails.scheme)
    this.moranPlot.setFillColorFunction(modeDetails.colorFunction)
  }
}


const dataConfig = document.getElementById("data-config")
dataConfig.addEventListener("click", () => {
  const content = dataConfig.nextElementSibling // TODO: I don't like this.
  content.style.display = content.style.display == "block" ? "none" : "block" 
})


const webMoran = new WebMoran()


// const weightManager = new WeightManager(weightMatrix => {
//   calculationManager.calculate
// }) 

const dataDetailsManager = new DataDetailsManager({
  callback: (data, vField) => {
    console.log(" - Data Details:", data, vField)
    webMoran.updateDataDetails(data, vField)
  }
})

new DataFileManager(data => {
  dataDetailsManager.updateData(data, true)
})


