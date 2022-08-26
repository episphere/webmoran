import {Plot} from "./Plot.js"
import {DynamicState} from "./DynamicState.js"
import * as d3 from "https://cdn.skypack.dev/d3@7"

export class DataMap extends Plot {
  constructor(element, data, vField, opts={}) {
    super(element, opts, {
      missingColor: "#949494",
      missingPattern: true,
      colorScheme: d3.interpolateReds,
      outlineColorFunction: () => "grey",
      fillColorFunction: null,
      colorScale: null,
      centerColorZero: false,
      areaName: null,
      numberFormat: d => d,
      boldFeatures: [],
    })

    this.element = element
    this.data = data
    this.vField = vField

    this.setup()
    this.createBase()
    this.dataUpdated()
    element.append(this.nodes.base.node())
  }

  setupData() {
    this.valuedFeatures = this.data.features.filter(d => this.vField in d.properties)
    this.featureIndex = d3.index(this.data.features, d => d.id)

    let valueExtent = d3.extent(this.valuedFeatures, d => d.properties[this.vField])

    if (this.centerColorZero) {
      const colorMaxMag = Math.max(...valueExtent.map(d => Math.abs(d)))
      valueExtent = [-colorMaxMag, colorMaxMag]
    }
  }

  setup() {
    
    const numberFormatBase = this.numberFormat
    const numberFormat = d => {
      if (typeof d == "number") {
        return numberFormatBase(d)
      } else {
        return d
      }
    }
    this.numberFormat = numberFormat


    this.path = d3.geoPath()
    this.bbox = this.path.bounds(this.data)

    if (!this.width) {
      this.width = Math.abs(this.bbox[1][0] - this.bbox[0][0])
    }
    if (!this.height) {
      this.height = Math.abs(this.bbox[1][1] - this.bbox[0][1])
    }

    // Center on a feature and fit size to all features
    const focusFeature = this.focusFeature ? this.focusFeature : this.data
    const projection = d3.geoIdentity()
      .fitSize([this.width, this.height], focusFeature)
    this.path.projection(projection)

    for (const feature of this.data.features) {
      feature.centroid = this.path.centroid(feature)
      feature.bounds = this.path.bounds(feature)
    }

    if (!this.colorScale) {
      this.colorScale = d3.scaleSequential(this.colorScheme)
    }

    if (!this.clusterColorScale) {
      this.clustColorScale = d3.scaleOrdinal(d3.schemeCategory10)
        .domain([0, 1, 2])
    }

    this.setupData()
    this.setVField(this.vField)

    if (!this.fillColorFunction) {
      this.fillColorFunction = this.fill
    }

    this.state = new DynamicState()
    this.state.defineProperty("focused", null)
    this.state.defineProperty("select", new Set())
    this.state.addListener((p, v, o) => {
      this.stateChanged(p, v, o)
    })
  }

  createBase() {
    this.nodes.base = d3.create("svg")
      .attr("width", this.width)
      .attr("height", this.height)
      .on("mouseleave", () => this.state.focused = null)
      .on("click", () => {
        this.state.select = new Set()
      })

    this.mapNode = this.nodes.base.append("g")
    this.mapNode.selectAll("path")
      .data(this.data.features)
      .join("path")
        .attr("d", this.path)
        .attr("id", d => "data-area-" + d.id)
        .attr("stroke", this.outlineColorFunction)
        .attr("stroke-width", .5)
        .on("mouseenter", (_, d) => this.state.focused = d.id)
        .on("mouseleave", () => this.state.focused = null)
        .on("click", (e, d) => {
          e.stopPropagation()
          if (this.state.select.has(d.id)) {
            this.state.select.delete(d.id)
            this.state.select = this.state.select
          } else {
            this.state.select = this.state.select.add(d.id)
          }
        })

    this.boldMapNode = this.nodes.base.append("g")
    this.boldMapNode.selectAll("path")
      .data(this.boldFeatures)
      .join("path")
        .attr("d", this.path)
        .attr("stroke", "grey")
        .attr("stroke-width", .5)
        .attr("fill", "none")

    this.selectIndex = new Map()
    for (const feature of this.data.features) {
      const select = this.mapNode.select(`#data-area-${feature.id}`)
      this.selectIndex.set(feature.id, select)
    }

    this.nodes.base.append("defs")
      .append("pattern")
      .attr("id", "dot-pattern")
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", 3)
      .attr("height", 3)
      .append("circle")
        .attr("cx", 1)
        .attr("cy", 1)
        .attr("r", .5)
        .attr("fill", this.missingColor)
    this.tooltip = d3.select(this.element).append("div")
      .style("opacity", 0)
      .attr("class", "tooltip")
      .style("background-color", "rgba(255, 255, 255, .7)")
      .style("border", "solid")
      .style("border-width", "1px")
      .style("border-radius", "2px")
      .style("padding", "5px")
      .style("position", "absolute")
      .style("font-size", ".6em")
      .style("pointer-events", "none")
      .style("z-index", 1)
  }

  dataUpdated() {

    this.setupData()

    this.mapNode.selectAll("path")
      .attr("fill", d => {
        return this.fillColorFunction(d.properties)
      })

  }

  setVField(vField, reverse = false, centerZero = false) {
    this.vField = vField
    let valueExtent = d3.extent(this.data.features.filter(
      d => !isNaN(parseFloat(d.properties[vField]))), d => d.properties[vField])
    
    if (reverse) {
      valueExtent = [...valueExtent].reverse()
    }

    if (centerZero) {
      const colorMaxMag = Math.max(...valueExtent.map(d => Math.abs(d)))
      valueExtent = [-colorMaxMag, colorMaxMag]
    }

    this.colorScale.domain(valueExtent)
  }

  setFillColorFunction(fillColorFunction) {
    this.fillColorFunction = fillColorFunction ? fillColorFunction : this.fill
    this.mapNode.selectAll("path")
      .attr("fill", d => this.fillColorFunction(d.properties))
  }

  setColorScheme(scheme) {
    this.colorScheme = scheme 
    this.colorScale.interpolator(this.colorScheme)
    this.mapNode.selectAll("path")
      .attr("fill", d => this.fillColorFunction(d.properties))
  }

  fill(properties) {
    if (this.vField in properties) {
      return this.colorScale(properties[this.vField])
    } else {
      // Pattern causes slow-down, removing for now
      //return this.missingPattern ? "url(#dot-pattern)" : this.missingColor
      return "lightgrey"
    }
  }

  highlight(targets, olds) {

    const focused = this.selectIndex.get(targets[0])
    if (focused) {
      focused.raise()
      focused.attr("stroke", "yellow")
        .attr("stroke-width", 2)
    }

    const unfocused = this.selectIndex.get(olds[0])
    if (unfocused) {
      unfocused.attr("stroke", this.outlineColorFunction)
        .attr("stroke-width", .5)
    }
  
    // for (const old of olds) {
    //   const prevFocused = d3.select(`#data-area-${old}`)
    //   prevFocused.attr("stroke", this.outlineColorFunction)
    //   prevFocused.attr("stroke-width", 0.5)
    //   prevFocused.lower()
    // }

    // for (const target of targets) {
    //   const focused = d3.select(`#data-area-${target}`)
    //   focused.attr("stroke", "yellow")
    //   focused.attr("stroke-width", 2)
    //   focused.raise()
    // }
  }
 
  stateChanged(p, v, o) {

    if (p == "focused" && v != o) {
      this.highlight([v], this.state.select.has(o) ? [] : [o])

      if (v) {
        const feature = this.data.features.find(d => d.id == v)
        if (feature) {
          this.tooltip.style("opacity", 1)
          // this.tooltip.style("left", `${feature.center[0] + 5}px`)
          // this.tooltip.style("top", `${feature.center[1] + 5}px`)
          this.tooltip.style("left", `${feature.bounds[1][0] + 5}px`)
          this.tooltip.style("top", `${feature.bounds[1][1] + 5}px`)

          let tipAreaName = null
          let tipAreaValue = null 
          if (this.areaName && feature.properties[this.areaName]) {
            tipAreaName = this.areaName
            tipAreaValue = feature.properties[tipAreaName]
          } else {
            tipAreaName = "id"
            tipAreaValue = feature.id
          }

          const value = feature.properties[this.vField] != null ? 
            this.numberFormat(feature.properties[this.vField]) : "<i>[missing]</i>"
          
          this.tooltip.html(`<b>${tipAreaName}</b>: ${tipAreaValue} </br> 
            <b>${this.vField}</b>: ${value}`)
        }
      } else {
        this.tooltip.style("opacity", 0)
      }
      
    } else if (p == "select") {
      const olds = [...o].filter(d => !v.has(d) && d != this.state.focused)
      const vals = [...v].filter(d => !o.has(d))
      this.highlight(vals, olds)
    }
  }
}