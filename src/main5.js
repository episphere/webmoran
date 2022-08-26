
import { DataMap } from "./classes/DataMap2.js"
import { MoranPlot } from "./classes/MoranPlot2.js"
import { ColorKey } from "./classes/ColorKey.js"


import * as geo from "./geospatial.js"

// TODO: JSON support
// TODO: Area name configure

//const WORKER_PATH = "src/workerMoran.js" // For local
const WORKER_PATH = "/webmoran/src/workerMoran.js" // For live

// TODO: Update p value in Moran plot

// TODO: Cluster and significance values missing

// Basic input components

class Select {
  constructor(props, element) {
    props = {
      label: "Select:",
      values: [],
      handleChange: () => null, 
      placeholderText: "<span style='color:grey'>No values...</span>",
      active: true, 
      disabled: false,
      ...props
    }

    this.label = props.label 
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

    const label = document.createElement("label")
    label.innerHTML = this.label 
    this.element.appendChild(label)

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

class RadioMultiSelect {
  constructor(props, element) {
    props = {
      name: "radio-select",
      label: "",
      values: [],
      handleChange: () => null,
      ...props
    }

    this.name = props.name
    this.values = props.values 
    this.label = props.label 
    this.value = props.value ? props.value : props.values[0]
    this.handleChange = props.handleChange

    this.element = element 

    this.updateValues(this.values, this.value, false)
  }

  updateValues(values, defaultValue = null, trigger = true) {

    this.values = values 
    this.element.innerHTML = ""

    this.valueMap = new Map()

    const label = document.createElement("span")
    label.innerHTML = this.label 
    this.element.appendChild(label)
    
    this.value = null
    values.forEach((value, i) => {

      if (typeof value != "object") {
        value = {value: value, label: value}
      }

      const id = `radio-${this.name}-${value.value}`

      const label = document.createElement("label")
      label.setAttribute("for", id)
      label.innerHTML = value.label

      const input = document.createElement("input")
      input.setAttribute("id", id)
      input.setAttribute("type", "radio")
      input.setAttribute("value", value.value)
      input.setAttribute("name", this.name)
      if (value.disabled) {
        input.setAttribute("disabled", "")
      }
      if (value.value == defaultValue) {
        input.setAttribute("checked", "")
        this.value = value.value
      }
      input.addEventListener("click", e => {
        this.value = e.target.value
        this.handleChange(this.value)
      })

      this.valueMap.set(value.value, input)
      
      this.element.appendChild(input)
      this.element.appendChild(label)
    })
  }

  setValue(value) {
    this.valueMap.get(value).click()
  }

  setValueDisabled(value, disabled) {
    const input= this.valueMap.get(value)
    if (disabled) {
      input.setAttribute("disabled", disabled)
    } else {
      input.removeAttribute("disabled")
    }
  }
}

class Check {
  constructor(props, element) {
    props = {
      label: "",
      handleChange: () => null,
      value: true,
      ...props
    }

    this.handleChange = props.handleChange
    this.label = props.label
    this.value = props.value

    this.element = element 
    this.div = document.createElement("div")

    const label = document.createElement("label")
    //label.setAttribute("for", id)
    label.innerHTML = this.label

    const check = document.createElement("input")
    check.setAttribute("type", "checkbox")
    if (this.value) {
      check.setAttribute("checked", "")
    }
    check.addEventListener("click", () => {
      this.value = check.checked
      this.handleChange(check.checked)
    })

    this.div.appendChild(check)
    this.div.appendChild(label)

    this.element.appendChild(this.div)
  }
}

class FileSelect {
  constructor(props, element) {
    props = {
      label: "File:",
      handleChange: () => null, 
      defaultFileDataWrappers: [],
      parse: d => d,
      accept: [],
      placeholderText: "<span style='color:grey'>Awaiting file...</span>",
      disabled: false,
      ...props
    }

    this.label = props.label
    this.handleChange = props.handleChange
    this.parse = props.parse
    this.accept = props.accept
    this.fileMap = new Map(props.defaultFileDataWrappers.map(d => [d.name, d.data]))
    this.disabled = props.disabled
    this.element = element 

    this.handleSelectChange = this.handleSelectChange.bind(this)

    this.select = new Select({
      label: this.label,
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
    fileInput.setAttribute("accept", this.accept.join(","))

    this.button = document.createElement("button")
    this.button.innerHTML = `<span class="material-icons">file_upload</span>`
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
        label: "Geo File:",
        defaultFileDataWrappers: [
          {name: "us_topology_county.geojson", data: geoDataCounty},
          {name: "us_topology_state.geojson", data: geoDataState},
        ],
        handleChange: this.handleGeoChange,
        accept: [".json", ".geojson"]
      }, document.getElementById("geo-file-pick"))
      this.geoData = this.geoFileSelect.value.data
      
      this.rowFileSelect = new FileSelect({
        label: "Data File:",
        defaultFileDataWrappers: [
          {name: "chr_data_2022_small.csv", data: rowData},
        ],
        accept: [".csv"], // TODO: Support JSON
        handleChange: this.handleRowChange,
        parse: d3.csvParse,
      }, document.getElementById("row-file-pick"))
      
      this.idFieldSelect = new Select({
        label: "ID Field:",
        values: [], handleChange: this.handleIdFieldChange, defaultValue: "fipscode",
      }, document.getElementById("id-field-select"))

      this.handleRowChange(this.rowFileSelect.value)
    })

   
  }

  handleGeoChange(value) {
    this.geoData = JSON.parse(value.data)
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

    const ids = new Set(this.geoData.features.map(d => d.id))
    const possibleIdFields = [...fields].map(field => 
      [field, this.rowData.filter(row => ids.has(row[field])).length])
    possibleIdFields.sort((a,b) => b[1] - a[1])
    const defaultField = possibleIdFields.length > 0 ? possibleIdFields[0][0] : null

    this.idFieldSelect.updateValues([...fields], defaultField)
  }
  
  handleIdFieldChange(value) {
    this.idField = value
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

    // We need to keep this to prevent values being erased by the parseFloat
    //this.propertiesMap = this.data.features.forEach(d => [d.id, d.properties])

    this.data = props.data
    this.usedFields = props.usedFields
    this.callback = props.callback

    this.handleChange = this.handleChange.bind(this)

    this.subAreaFieldSelect = new Select({
      label: "Sub Area Field:",
      values: [], handleChange: this.handleChange, defaultValue: "state", //active: false, 
    }, document.getElementById("subarea-field-select"))

    this.subAreaSelect = new Select({
      label: "Sub Area:",
      values: [], handleChange: this.handleChange, defaultValue: "VA", //active: false 
    }, document.getElementById("subarea-select"))
    
    this.valueFieldSelect = new Select({
      label: "Value Field:",
      values: [], handleChange: this.handleChange, defaultValue: "adult_smoking", //active: false
    }, document.getElementById("value-field-select"))



    //this.updateData(this.data, false)
  }

  handleChange() {
    this.previousValueField = this.valueField

    this.valueField = this.valueFieldSelect.value 
    this.subAreaField = this.subAreaFieldSelect.value 
    this.subArea = this.subAreaSelect.value

    this.updateData(this.data)
  }


  updateData(data, trigger = true, usedFields = []) {
    this.data = data
    
    const fields = new Set()
    for (const feature of this.data.features) {
      for (const field of Object.keys(feature.properties)) {
        fields.add(field)
      }
    }

    const usedFieldsSet = new Set(usedFields)
    const possibleValueFields = [...fields].map(field => 
      [field, usedFieldsSet.has(field) ? -1 : this.data.features.filter(d => !isNaN(d.properties[field])).length])
    possibleValueFields.sort((a,b) => b[1] - a[1])

    const defaultValueField = 
      possibleValueFields.length < 1 || fields.has(this.valueFieldSelect.defaultValue) || fields.has(this.valueField) ? 
      this.valueField : possibleValueFields[0][0]

    this.valueFieldSelect.updateValues([...fields], defaultValueField, false)
    this.subAreaFieldSelect.updateValues(["NONE", ...fields], this.subAreaField, false)

    this.valueField = this.valueFieldSelect.value 
    this.subAreaField = this.subAreaFieldSelect.value 

    const areas = new Set()
    if (this.subAreaField != "NONE") {
      for (const feature of this.data.features) {
        const area = feature.properties[this.subAreaField]
        if (area) {
          areas.add(area)
        }
      }
    }

    this.subAreaSelect.updateValues([...areas].sort(), this.subArea, false)
   
    this.subArea = this.subAreaSelect.value

    this.processData()
  }

  processData() {

    //this.previousValues 
    //if (this.previousValueField)

    let features = this.data.features
    if (this.subAreaField != "NONE") {
      features = features.filter(feature => feature.properties[this.subAreaField] == this.subArea)
    }

    this.previousValues = features.map(d => d.properties[this.previousValueField])

    features = features.map(feature => ({
      ...feature,
      properties: {...feature.properties},
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
    this.handleFileChange = this.handleFileChange.bind(this)

    this.weightMethodSelect = new Select({
      label: "Weight Method:", value: "Queen",
      values: ["Rook", "Queen", "File"], handleChange: this.handleChange,
    }, document.getElementById("weight-method-select"))

    this.weightFileSelect = new FileSelect({
      label: "Weight File:",
      handleChange: this.handleFileChange,
      disabled: true,
      accept: [".gwt", ".gal"]
    }, document.getElementById("weight-file-pick"))

    this.handleChange(this.weightMethodSelect.value)
    //geo.calculateWeightMatrix
  }

  handleChange(value) {

    this.method = value
    if (this.method == "File") {
      this.weightFileSelect.setDisabled(false)

      if (this.fileWrapper) {
        this.parseWeights(this.fileWrapper)
      }
    } else {
      this.weightFileSelect.setDisabled(true)

      if (this.data) {
        this.calculateWeights(this.data)
      }
    }
  }

  calculateWeights(data) {
    this.data = data

    let weightMatrix = null
    if (this.method == "Rook" || this.method == "Queen") {
      weightMatrix = geo.calculateWeightMatrix(data, this.method)
    } 

    this.callback(weightMatrix, data)
  }

  parseWeights(fileWrapper) {
    
    const weightMatrix = new Map()
    const rows = fileWrapper.data.trim().split("\n").map(d => d.split(/\s+/))
    if (fileWrapper.name.toLowerCase().endsWith(".gwt")) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] 
        let toMap = weightMatrix.get(row[0])
        if (toMap == null) {
          toMap = new Map()
          weightMatrix.set(row[0], toMap)
        }
        toMap.set(row[1], parseFloat(row[2]))
      }

      // Normalize 
      for (const toMap of weightMatrix.values()) {
        const sum = d3.sum([...toMap.values()])
        for (const [k,v] of toMap.entries()) {
          toMap.set(k, v/sum)
        }
      }

    } else if (fileWrapper.name.toLowerCase().endsWith(".gal")) {
      for (let i = 1; i < rows.length-1; i+=2) {
        const firstRow = rows[i] 
        const secondRow = rows[i+1] 

        let toMap = weightMatrix.get(firstRow[0])
        if (toMap == null) {
          toMap = new Map()
          weightMatrix.set(firstRow[0], toMap)
        }

        for (const neighbor of secondRow) {
          toMap.set(neighbor, 1/firstRow[1])
        }
      }
    }

    this.callback(weightMatrix, this.data)
  }

  handleFileChange(value) {
    this.fileWrapper = value

    // TODO: Implement weight files
    this.parseWeights(value)
  }
}

class CalculationManager {
  constructor(initialCallback, finalCallback) {
    this.initialCallback = initialCallback 
    this.finalCallback = finalCallback
    this.progressElement = document.getElementById("progress")

    this.workerMoran = new Worker(WORKER_PATH, { type: "module" })

    this.workerMoran.addEventListener("message", e => {
      if (e.data.progress < 1) {
        const p = e.data.progress
        this.progressElement.innerHTML = `Calculating p-values: ${(p*100).toFixed(0)}%`
      } else {
        this.progressElement.innerHTML = ``
        this.finalCallback(e.data.moranResult)
      }
    })
  }

  calculate(data, vField, weightMatrix) {
    geo.calculateMoran(data.features, vField, weightMatrix).then(result => {
      this.initialCallback(result)
      return result  
    }).then(result => {
      
      this.workerMoran.postMessage({
        moranResult: result, 
        weightMatrix: weightMatrix,
        permutations: 999 
      })

      // geo.calculatePValues(result, weightMatrix, {
      //   progressCallback: p => p
      // }).then(result => {
      //   this.finalCallback(result)
      // })
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
    this.updateDataDetails = this.updateDataDetails.bind(this)
    this.keyDown = this.keyDown.bind(this)

    this.weightManager = new WeightManager(this.handleWeightChange)
    this.calculationManager = new CalculationManager(this.handleInitialResults, this.handleFinalResults)
    this.dataDetailsManager = new DataDetailsManager({
      callback: this.updateDataDetails
    })
    this.dataFileManager = new DataFileManager(data => {
      this.dataDetailsManager.updateData(data, true, [this.dataFileManager.idField])
    })

    this.progressElement = document.getElementById("progress")

    this.colorSchemeSelect = new Select({
      label: "Colors:",
      values: [], handleChange: this.handleSchemeChange, defaultValue: "Cividis", 
    }, document.getElementById("color-scheme-select"))

    const clusterColorScale = d3.scaleOrdinal(
      ["Not significant", "High-High", "Low-Low", "Low-High", "High-Low", null],
      ['#eeeeee', '#FF0000', '#0000FF', '#a7adf9', '#f4ada8', "#000000"])
    this.clusterColorFunction = d => {
      return clusterColorScale(d.label)
    }

    const pColorScale = d3.scaleOrdinal(
      [0.05, 0.01, 0.001, 0.0001],
      Array.from({length: 4}, (_, i) => d3.interpolateGreens((i+1)/5)))
    const pColorFunction = d => {
      return d.pCutoff ? pColorScale(d.pCutoff) : "whitesmoke"
    }

    this.modeSelect = new RadioMultiSelect({
      label: "Mode:",
      values: [
        {value: "moran", label: "Moran [z]"},
        {value: "significance", label: "Significance [x]", disabled: true},
        {value: "cluster", label: "Cluster [c]", disabled: true},
        {value: "value", label: "Value [v]"}
      ],
      handleChange: this.handleModeSelect,
      value: "value"
    }, document.getElementById("color-mode-radio"))

    document.addEventListener('keydown', this.keyDown)

    this.radialCheck = new Check({
      label: "Radial",
      handleChange: value => this.moranPlot.radialMap = (value ? this.radialMap : null)
    }, document.getElementById("radial-check"))

    d3.json("data/colorSchemes.json").then(schemes => {
      this.colorSchemeSelect.updateValues(schemes.map(d => [d[1], d[0]]), "Cividis")

      this.modeMap = new Map([
        ["value", {
          field: () => this.vField, 
          scheme: () => this.colorScheme, 
          colorFunction: null, 
          scaleType: "continuous", 
          colorScale: () => this.colorScale,
          title: () => {
            let title = this.vField
            if (title.length >= 17) {
              title = title.slice(0, 13) + "..."
            }
            return title
          }
        }],
        ["moran", {
          field: "localMoran", 
          scheme: () => d3.interpolatePiYG, 
          colorFunction: null, 
          center: true, 
          scaleType: "continuous", 
          colorScale: () => this.colorScale,
          title: () => "Local Moran's I"
        }],
        ["cluster", {
          field: "label", 
          scheme: () => null, 
          colorFunction: this.clusterColorFunction, 
          scaleType: "categorical", 
          colorScale: () => clusterColorScale,
          title: () => "Cluster"
        }],
        ["significance", {
          field: "p", 
          scheme: () => null, 
          colorFunction: pColorFunction, 
          scaleType: "categorical", 
          colorScale: () => pColorScale,
          title: () => "Pseudo p"
        }]
      ])
    })
  }

  keyDown(e) {
    if (e.target != document.body) {
      return
    }
  
    if (e.code == "KeyC") {
      this.modeSelect.setValue("cluster")
    } else if (e.code == "KeyX" ) {
      this.modeSelect.setValue("significance")
    } else if (e.code == "KeyV" ) {
      this.modeSelect.setValue("value")
    } else if (e.code == "KeyZ") {
      this.modeSelect.setValue("moran")
    }
  }

  updateDataDetails(data, vField) {
    this.data = data
    this.vField = vField

    //this.progressElement.innerHTML = `Calculating weights...`
    this.weightManager.calculateWeights(data)
  }

  handleWeightChange(weightMarix) {
    this.weightMatrix = weightMarix
    this.calculationManager.calculate(this.data, this.vField, this.weightMatrix)
  }

  handleInitialResults(moranResult) {

    if (this.modeSelect.value == "significance" || this.modeSelect.value == "cluster") {
      this.modeSelect.setValue("value")
    }
    
    this.modeSelect.setValueDisabled("significance", true)
    this.modeSelect.setValueDisabled("cluster", true)

    
    const valueExtent = d3.extent(this.data.features.filter(
      d => !isNaN(parseFloat(d.properties[this.vField]))), d => d.properties[this.vField])
    this.colorScale = d3.scaleSequential(this.colorScheme)
      .domain(valueExtent)

    this.localResults = moranResult.localMorans
    this.localResultMap = new Map(moranResult.localMorans.map(d => [d.id, d]))
    for (const feature of this.data.features) {
      const localResult = this.localResultMap.get(feature.id)
      //localResult.neighbors.forEach(d => d.localMoran = this.localResultMap.get(d.id))

      if (localResult) {
        feature.properties.localMoran = localResult.localMoran
      } 
    }

    const mapElement = document.getElementById("plot-datamap")
    this.dataMap = new DataMap(mapElement, this.data, this.vField, {
      colorScale: this.colorScale, 
      width: 400, height: 400
    })


    const moranElement = document.getElementById("plot-moran")
    if (moranResult.localMorans.length > 0) {
      const centroidMap = new Map(this.data.features.map(d => [d.id, d.centroid]))
      // TODO: remove data field. 
      this.radialMap = geo.localMoranRadials(moranResult, centroidMap)
  
     
      this.moranPlot = new MoranPlot(moranElement, moranResult, {
        colorField: this.vField, radialMap: this.radialMap,
        fixedColorScale: this.colorScale, state: this.dataMap.state,
        width: 400, height: 400, numberFormat: d => d.toFixed(2)
      })
      this.moranPlot.radialMap = this.radialCheck.value ? this.moranPlot.radialMap : null
    } else {
      moranElement.innerHTML = ``
    }

  

    this.handleModeSelect(this.modeSelect.value)
  }

  handleFinalResults(moranResult) {

    // Because we're using a WebWorker, the results are a copy of the original results,
    // so we need to manually update the original present in the plot objects. 
    moranResult.localMorans.forEach((d, i) => {
      const localMoran = this.localResults[i]
      for (const [k, v] of Object.entries(d)) {
        localMoran[k] = v
      }
    })

    for (const feature of this.data.features) {
      const localResult = this.localResultMap.get(feature.id)
      if (localResult) {
        feature.properties.p = localResult.p
        feature.properties.pCutoff = localResult.pCutoff
        feature.properties.label = localResult.label
      } 
    }

    this.moranPlot.setMoranResult(moranResult)
    this.modeSelect.setValueDisabled("significance", false)
    this.modeSelect.setValueDisabled("cluster", false)
    this.moranPlot.updateTooltip()
  }

  handleSchemeChange(scheme) {
    this.colorScheme = d3["interpolate" + scheme]

    if (!this.dataMap || !this.moranPlot) {
      return
    }

    this.dataMap.setColorScheme(this.colorScheme)
    this.moranPlot.setColorScheme(this.colorScheme)

    new ColorKey(document.getElementById("plot-key"), this.colorScale, this.modeDetails.scaleType, 
     {width:95, title: this.modeDetails.title(), margin:{left: 30, right: 45, top: 10, bottom: 10,}})
  }

  handleModeSelect(mode) {
    const modeDetails = this.modeMap.get(mode)
    this.modeDetails = modeDetails

    const vField = typeof modeDetails.field == "function" ? 
      modeDetails.field() : modeDetails.field
    const scheme = modeDetails.scheme()
    const colorScale = modeDetails.colorScale()

    this.colorScale.interpolator(scheme)
    this.dataMap.setVField(vField, false, modeDetails.center)
    //this.dataMap.setColorScheme(modeDetails.scheme)
    this.dataMap.setFillColorFunction(modeDetails.colorFunction)

    this.moranPlot.setColorField(vField)
    //this.moranPlot.setColorScheme(modeDetails.scheme)
    this.moranPlot.setFillColorFunction(modeDetails.colorFunction)

    const disabled = mode != "value"
    this.colorSchemeSelect.setDisabled(disabled)


    new ColorKey(document.getElementById("plot-key"), colorScale, modeDetails.scaleType, 
        {width:95,  title: modeDetails.title(), margin:{left: 30, right: 45, top: 10, bottom: 10,}})
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

// const dataDetailsManager = new DataDetailsManager({
//   callback: (data, vField) => {
//     webMoran.updateDataDetails(data, vField)
//   }
// })

// new DataFileManager(data => {
//   dataDetailsManager.updateData(data, true)
// })


