import moment from 'moment'
import {DATE_FORMAT_APP, DATE_FORMAT_ECDC, GRAPH_SCALE, METRICS} from './constants'

export const parseRawData = rawData => {
  let perDateData = {}
  const globalPerDay = []
  const datesAvailable = new Set()
  const geoIds = new Set()
  const geoIdToNameMapping = {}

  if (!rawData[0]?.dateRep) {
    return null
  }

  rawData.map(record => {
    const cases = parseInt(record.cases)
    const deaths = parseInt(record.deaths)
    const population = parseInt(record.popData2018) || getMissingPopulation(record)
    const name = record.countriesAndTerritories.split('_').join(' ')
    const dateKey = moment(record.dateRep, DATE_FORMAT_ECDC).format(DATE_FORMAT_APP)

    datesAvailable.add(dateKey)
    geoIds.add(record.geoId)
    geoIdToNameMapping[record.geoId] = name

    if (!perDateData[dateKey]) {
      perDateData[dateKey] = []
    }

    perDateData[dateKey].push({
      name: name,
      [METRICS.CASES_NEW]: cases,
      [METRICS.DEATHS_NEW]: deaths,
      geoId: record.geoId,
      population: population,
    })

    if (!globalPerDay[dateKey]) {
      globalPerDay[dateKey] = createInitialEntryPerCountry('Combined Data', 'WW', 0)
      geoIdToNameMapping.WW = 'Combined Data'
    }

    globalPerDay[dateKey][METRICS.CASES_NEW] += cases
    globalPerDay[dateKey][METRICS.DEATHS_NEW] += deaths
    globalPerDay[dateKey].population += population
  })
  for (let dateKey of Object.keys(perDateData)) {
    perDateData[dateKey].push(globalPerDay[dateKey])
    perDateData[dateKey] = calculateRatesData(perDateData[dateKey])
  }
  const sortedDates = getSortedDates(datesAvailable)
  perDateData = calculateAccumulatedData(perDateData, sortedDates)

  return {
    rawData: rawData,
    startDate: sortedDates[0] ?? null,
    endDate: sortedDates[sortedDates.length - 1] ?? null,
    datesAvailable: sortedDates,
    geoIds: [...geoIds].sort(),
    geoIdToNameMapping: geoIdToNameMapping,
    perDateData: perDateData,
  }
}

const getSortedDates = datesSet => {
  return [...datesSet].sort((a, b) => moment(a, DATE_FORMAT_APP).toDate() - moment(b, DATE_FORMAT_APP).toDate())
}

const calculateRatesData = data => {
  return data.map(element => {
    // if (element.geoId === 'JPG11668') debugger

    element[METRICS.CASES_PER_CAPITA] = calculateRate(element[METRICS.CASES_NEW], element.population, 1000000)
    element[METRICS.DEATHS_PER_CAPITA] = calculateRate(element[METRICS.DEATHS_NEW], element.population, 1000000)
    element[METRICS.MORTALITY_PERCENTAGE] = calculateRate(element[METRICS.DEATHS_NEW], element[METRICS.CASES_NEW], 100)

    return element
  })
}

const calculateAccumulatedData = (perDateData, sortedDates) => {
  let perGeoIdAccumulatedData = {}

  for (const dateKey of sortedDates) {
    perDateData[dateKey].forEach(entry => {
      if (!perGeoIdAccumulatedData[entry.geoId]) {
        perGeoIdAccumulatedData[entry.geoId] = {
          [METRICS.CASES_ACCUMULATED]: 0,
          [METRICS.DEATHS_ACCUMULATED]: 0,
        }
      }

      perGeoIdAccumulatedData[entry.geoId][METRICS.CASES_ACCUMULATED] += entry[METRICS.CASES_NEW]
      perGeoIdAccumulatedData[entry.geoId][METRICS.DEATHS_ACCUMULATED] += entry[METRICS.DEATHS_NEW]

      entry[METRICS.CASES_ACCUMULATED] = perGeoIdAccumulatedData[entry.geoId][METRICS.CASES_ACCUMULATED]
      entry[METRICS.DEATHS_ACCUMULATED] = perGeoIdAccumulatedData[entry.geoId][METRICS.DEATHS_ACCUMULATED]

      entry[METRICS.CASES_PER_CAPITA_ACCUMULATED] = calculateRate(
        perGeoIdAccumulatedData[entry.geoId][METRICS.CASES_ACCUMULATED],
        entry.population,
        1000000
      )
      entry[METRICS.DEATHS_PER_CAPITA_ACCUMULATED] = calculateRate(
        perGeoIdAccumulatedData[entry.geoId][METRICS.DEATHS_ACCUMULATED],
        entry.population,
        1000000
      )
      entry[METRICS.MORTALITY_PERCENTAGE_ACCUMULATED] = calculateRate(
        perGeoIdAccumulatedData[entry.geoId][METRICS.DEATHS_ACCUMULATED],
        perGeoIdAccumulatedData[entry.geoId][METRICS.CASES_ACCUMULATED],
        100
      )
    })
  }

  return perDateData
}

const parseSectionData = (perDateData = {}, startDate, endDate) => {
  const perGeoIdData = {}

  for (let [dateKey, entriesForDate] of Object.entries(perDateData)) {
    if (startDate && moment(dateKey, DATE_FORMAT_APP).isBefore(startDate, 'day')) {
      continue
    }

    if (endDate && moment(dateKey, DATE_FORMAT_APP).isAfter(endDate, 'day')) {
      continue
    }

    for (let entry of entriesForDate) {
      if (!perGeoIdData[entry.geoId]) {
        perGeoIdData[entry.geoId] = createInitialEntryPerCountry(entry.name, entry.geoId, entry.population)
      }
      perGeoIdData[entry.geoId][METRICS.CASES_NEW] += entry[METRICS.CASES_NEW]
      perGeoIdData[entry.geoId][METRICS.DEATHS_NEW] += entry[METRICS.DEATHS_NEW]
    }
  }

  const endDateKey = endDate.format(DATE_FORMAT_APP)
  perDateData?.[endDateKey]?.map(entry => {
    if (!perGeoIdData[entry.geoId]) {
      perGeoIdData[entry.geoId] = createInitialEntryPerCountry(entry.name, entry.geoId, entry.population)
    }
    perGeoIdData[entry.geoId][METRICS.CASES_ACCUMULATED] = entry[METRICS.CASES_ACCUMULATED]
    perGeoIdData[entry.geoId][METRICS.DEATHS_ACCUMULATED] = entry[METRICS.DEATHS_ACCUMULATED]
    perGeoIdData[entry.geoId][METRICS.CASES_PER_CAPITA_ACCUMULATED] = entry[METRICS.CASES_PER_CAPITA_ACCUMULATED]
    perGeoIdData[entry.geoId][METRICS.DEATHS_PER_CAPITA_ACCUMULATED] = entry[METRICS.DEATHS_PER_CAPITA_ACCUMULATED]
    perGeoIdData[entry.geoId][METRICS.MORTALITY_PERCENTAGE_ACCUMULATED] =
      entry[METRICS.MORTALITY_PERCENTAGE_ACCUMULATED]
  })

  let resultData = Object.values(perGeoIdData)
  resultData = calculateRatesData(resultData)

  return resultData
}

/**
 * Per million rate
 * @param cases
 * @param total
 * @param referenceRate
 * @returns {number}
 */
const calculateRate = (cases, total, referenceRate) => {
  if (total === 0) {
    return 0
  }

  return changePrecision(cases / (total / referenceRate), 2)
}

const changePrecision = (number, precision) => {
  const factor = Math.pow(10, precision)
  const tempNumber = number * factor
  const roundedTempNumber = Math.round(tempNumber)

  return roundedTempNumber / factor
}

const createInitialEntryPerCountry = (name, geoId, population) => {
  return {
    [METRICS.CASES_NEW]: 0,
    [METRICS.DEATHS_NEW]: 0,
    name: name,
    geoId: geoId,
    population: population,
  }
}

// for some reason, the ECDC is missing the population count for these countries
const hardcodedPopulationData = {
  AI: 14731,
  BQ: 25711,
  CZ: 10665677,
  ER: 3452786,
  EH: 567402,
  FK: 3234,
}

const getMissingPopulation = element => {
  let population = null
  if (hardcodedPopulationData[element.geoId]) {
    population = hardcodedPopulationData[element.geoId]
  } else {
    console.warn('Missing population count for:', element.geoId, element.countriesAndTerritories)
  }

  return population
}

export const getTableData = (data, dateFilter, selectedGeoIds, maxSelectionReached) => {
  let startDate = moment(dateFilter.startDate, DATE_FORMAT_APP)
  let endDate = moment(dateFilter.endDate, DATE_FORMAT_APP)

  const sectionData = parseSectionData(data?.perDateData, startDate, endDate)

  return addSelectionColumn(sectionData, selectedGeoIds, maxSelectionReached)
}

const addSelectionColumn = (tableData, selectedGeoIds, maxSelectionReached) => {
  return tableData.map(entry => {
    entry.selected = selectedGeoIds[entry.geoId] || false
    entry.maxSelectionReached = maxSelectionReached

    return entry
  })
}

export const getGraphData = (
  data,
  dateFilter,
  selectedGeoIds,
  propertyName,
  lineGraphVisible,
  barGraphVisible,
  graphScale
) => {
  const result = {}

  if (!data?.perDateData) {
    return result
  }

  const startDate = moment(dateFilter.startDate, DATE_FORMAT_APP)
  const endDate = moment(dateFilter.endDate, DATE_FORMAT_APP)
  const cleanedData = {}

  for (let [dateKey, entriesForDate] of Object.entries(data.perDateData)) {
    const dateObj = moment(dateKey, DATE_FORMAT_APP)

    if (startDate.isValid() && dateObj.isBefore(startDate, 'day')) {
      continue
    }

    if (endDate.isValid() && dateObj.isAfter(endDate, 'day')) {
      continue
    }

    cleanedData[dateKey] = entriesForDate.filter(entry => !!selectedGeoIds[entry.geoId])
  }

  if (lineGraphVisible) {
    const {lineData, logarithmParams} = getLineGraphData(cleanedData, data.geoIdToNameMapping, propertyName, graphScale)
    result.lineData = lineData
    result.logarithmParams = logarithmParams
  }

  if (barGraphVisible) {
    result.barData = getBarGraphData(cleanedData, data.geoIdToNameMapping, selectedGeoIds, propertyName)
  }

  return result
}

const getBarGraphData = (cleanedData, geoIdToNameMapping, selectedGeoIds, propertyName) => {
  const parsedData = []

  for (let [dateKey, entriesForDate] of Object.entries(cleanedData)) {
    const newEntry = {date: dateKey, nameToGeoId: {}}
    entriesForDate.map(entry => {
      newEntry[geoIdToNameMapping[entry.geoId]] = entry[propertyName]
      newEntry.nameToGeoId[geoIdToNameMapping[entry.geoId]] = entry.geoId
    })
    parsedData.push(newEntry)
  }

  const geoIdList = Object.entries(selectedGeoIds)
    .filter(([key, value]) => value)
    .map(([key, value]) => key)
    .sort()

  const keys = geoIdList.map(geoId => geoIdToNameMapping[geoId])

  return {
    keys: keys,
    data: sortArrayByDateProperty(parsedData, 'date'),
  }
}

const getLineGraphData = (cleanedData, geoIdToNameMapping, propertyName, graphScale) => {
  const result = []
  let parsedData = {}
  const logarithmParams = {
    min: null,
    max: null,
  }

  for (let [dateKey, entriesForDate] of Object.entries(cleanedData)) {
    entriesForDate.map(entry => {
      if (!parsedData[entry.geoId]) {
        parsedData[entry.geoId] = []
      }
      let dateValue = entry[propertyName]

      if (graphScale === GRAPH_SCALE.LOGARITHMIC) {
        if (dateValue <= 0) {
          return
        }

        if (logarithmParams.min === null || dateValue < logarithmParams.min) {
          logarithmParams.min = dateValue
        }

        if (logarithmParams.max === null || dateValue > logarithmParams.max) {
          logarithmParams.max = dateValue
        }
      }

      parsedData[entry.geoId].push({
        x: dateKey,
        y: dateValue,
      })
    })
  }

  Object.keys(parsedData)
    .sort()
    // reverse alphabetic order because nivo graphs revert the order for the legend/tooltip
    .reverse()
    .map(geoId => {
      result.push({
        id: geoIdToNameMapping[geoId] || geoId,
        geoId: geoId,
        data: sortArrayByDateProperty(parsedData[geoId], 'x'),
      })
    })

  return {
    lineData: result,
    logarithmParams: logarithmParams,
  }
}

const sortArrayByDateProperty = (array, datePropertyKey) => {
  return array.sort(
    (a, b) =>
      moment(a[datePropertyKey], DATE_FORMAT_APP).toDate() - moment(b[datePropertyKey], DATE_FORMAT_APP).toDate()
  )
}
