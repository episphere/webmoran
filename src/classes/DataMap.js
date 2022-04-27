import {Plot} from "./Plot.js"
import {default as bboxGeo} from 'https://cdn.skypack.dev/geojson-bbox@0.0.0?min'
import {DynamicState} from "./DynamicState.js"
import * as d3 from "https://cdn.skypack.dev/d3@7"


// TODO: Color legend. 
export class DataMap extends Plot {
  constructor(element, data, vField, opts={}) {
    super(element, opts, {
      missingColor: "#949494",
      missingPattern: true,
      colorScheme: d3.interpolateCividis,
      outlineColorFunction: () => "grey",
      fillColorFunction: null,
      colorScale: null,
      centerColorZero: false,
      areaName: null,
      numberFormat: d => d,
      centerDrawList: new Set(), // TODO: delete
    })

    this.element = element
    this.data = data
    this.vField = vField

    this.setup()
    this.createBase()
    this.dataUpdated()
    element.append(this.nodes.base.node())
  }

  setup() {
    this.valuedFeatures = this.data.features.filter(d => this.vField in d.properties)

    const numberFormatBase = this.numberFormat
    const numberFormat = d => {
      if (typeof d == "number") {
        return numberFormatBase(d)
      } else {
        return d
      }
    }
    this.numberFormat = numberFormat

    this.bbox = bboxGeo(this.data)
    if (!this.width) {
      this.width = Math.abs(this.bbox[2] - this.bbox[0])
    }
    if (!this.height) {
      this.height = Math.abs(this.bbox[3] - this.bbox[1])
    }

    // Center on a feature and fit size to all features
    this.path = d3.geoPath()
    const focusFeature = this.focusFeature ? this.focusFeature : this.data
    const projection = d3.geoIdentity()
      .fitSize([this.width, this.height], focusFeature)
    this.path.projection(projection)

    for (const feature of this.valuedFeatures) {
      feature.center = this.path.centroid(feature)
    }

    if (!this.colorScale) {
      let valueExtent = d3.extent(this.valuedFeatures, d => d.properties[this.vField])

      if (this.centerColorZero) {
        const colorMaxMag = Math.max(...valueExtent.map(d => Math.abs(d)))
        valueExtent = [-colorMaxMag, colorMaxMag]
      }

      this.colorScale = d3.scaleSequential(this.colorScheme)
        .domain(valueExtent)
    }

    if (!this.clusterColorScale) {
      this.clustColorScale = d3.scaleOrdinal(d3.schemeCategory10)
        .domain([0, 1, 2])
    }

    if (!this.fillColorFunction) {
      this.fillColorFunction = this.fill
    }

    this.state = new DynamicState()
    this.state.defineProperty("focus", null)
    this.state.defineProperty("select", new Set())
    this.state.addListener((p, v, o) => {
      this.stateChanged(p, v, o)
    })
  }

  createBase() {
    this.nodes.base = d3.create("svg")
      .attr("width", this.width)
      .attr("height", this.height)
      .on("mouseleave", () => this.state.focus = null)
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
        .on("mouseover", (_, d) => this.state.focus = d.id)
        .on("mouseleave", () => this.state.focus = null)
        .on("click", (e, d) => {
          e.stopPropagation()
          if (this.state.select.has(d.id)) {
            this.state.select.delete(d.id)
            this.state.select = this.state.select
          } else {
            this.state.select = this.state.select.add(d.id)
          }
        })

    // this.mapNode.selectAll("path")
    //   .attr("opacity", d => this.centerDrawList.has(d.id ) ? "1" : ".3") // TODO: Delete


    this.nodes.centers = this.nodes.base.append("g")
      .selectAll("circle")
      .data(this.data.features.filter(d => this.centerDrawList.has(d.id)))
      .join("circle")
        .attr("cx", d => d.center[0])
        .attr("cy", d => d.center[1])
        .attr("fill", "red")
        .attr("r", 2)

    this.nodes.base.append("defs")
      .append("pattern")
      .attr("id", "dot-pattern")
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", 3)
      .attr("height", 3)
      .append("circle")
        .attr("cx", 1)
        .attr("cy", 1)
        .attr("r", 1)
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

  fill(properties) {
    if (this.vField in properties) {
      return this.colorScale(properties[this.vField])
    } else {
      return this.missingPattern ? "url(#dot-pattern)" : this.missingColor
    }
  }

  highlight(targets, olds) {
    for (const old of olds) {
      const prevFocused = d3.select(`#data-area-${old}`)
      prevFocused.attr("stroke", "grey")
      prevFocused.attr("stroke-width", 0.5)
      prevFocused.lower()
    }

    for (const target of targets) {
      const focused = d3.select(`#data-area-${target}`)
      focused.attr("stroke", "yellow")
      focused.attr("stroke-width", 2)
      focused.raise()
    }
  }
 
  stateChanged(p, v, o) {
    if (p == "focus") {
      this.highlight([v], this.state.select.has(o) ? [] : [o])

      if (v) {
        const feature = this.data.features.find(d => d.id == v)
        if (feature) {
          this.tooltip.style("opacity", 1)
          this.tooltip.style("left", `${feature.center[0] + 5}px`)
          this.tooltip.style("top", `${feature.center[1] + 5}px`)

          let tipAreaName = null
          let tipAreaValue = null 
          if (this.areaName) {
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
      const olds = [...o].filter(d => !v.has(d) && d != this.state.focus)
      const vals = [...v].filter(d => !o.has(d))
      this.highlight(vals, olds)
    }
  }
}