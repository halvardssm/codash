import React from 'react'
import {Col, Dropdown, DropdownButton, Form, Row} from 'react-bootstrap'
import BootstrapTable from 'react-bootstrap-table-next'
import paginationFactory, {
  PaginationListStandalone,
  PaginationProvider,
  PaginationTotalStandalone,
} from 'react-bootstrap-table2-paginator'
import ToolkitProvider, {Search} from 'react-bootstrap-table2-toolkit'
import {
  ACTION_CHANGE_GEOID_SELECTION,
  ACTION_CHANGE_SIZE_PER_PAGE,
  LOCALE_DEFAULT,
  METRICS,
} from '../../../global/constants'
import {getTableData} from '../../../global/dataParsing'
import {action} from '../../../global/util'

export const Table = ({data, dateFilter, selectedGeoIds, sizePerPage}) => {
  const {SearchBar} = Search
  const processedData = getTableData(data, dateFilter, selectedGeoIds)
  const paginationOptions = {
    custom: true,
    page: 1,
    sizePerPage: sizePerPage,
    totalSize: processedData.length,
    sizePerPageList: [
      {
        text: '10',
        value: 10,
      },
      {
        text: '25',
        value: 25,
      },
      {
        text: '50',
        value: 50,
      },
      {
        text: '100',
        value: 100,
      },
      {
        text: 'All',
        value: processedData.length,
      },
    ],
  }
  const hasPredefinedSizePerPage = paginationOptions.sizePerPageList.some(size => parseInt(size.text) === sizePerPage)
  const sizePerPageButtonText = hasPredefinedSizePerPage ? sizePerPage : 'All'

  return (
    <PaginationProvider pagination={paginationFactory(paginationOptions)}>
      {({paginationProps, paginationTableProps}) => (
        <ToolkitProvider keyField="geoId" data={processedData} columns={columns} bootstrap4 search>
          {({searchProps, baseProps}) => (
            <div id="main-table-container">
              <SearchBar {...searchProps} />
              <BootstrapTable
                noDataIndication={'no table data'}
                hover
                condensed
                striped
                {...paginationTableProps}
                {...baseProps}
              />
              <Row>
                <Col xs={3}>
                  <DropdownButton
                    className="react-bs-table-sizePerPage-dropdown"
                    id="pageDropDown"
                    drop={'up'}
                    onSelect={value => action(ACTION_CHANGE_SIZE_PER_PAGE, {sizePerPage: parseInt(value)})}
                    variant="secondary"
                    title={sizePerPageButtonText}
                  >
                    {paginationProps.sizePerPageList.map(size => (
                      <Dropdown.Item key={size.value} eventKey={size.value}>
                        {size.text}
                      </Dropdown.Item>
                    ))}
                  </DropdownButton>
                </Col>
                <Col xs={6}>
                  <PaginationListStandalone {...paginationProps} />
                </Col>
                <Col xs={3} className="text-right">
                  <PaginationTotalStandalone {...paginationProps} />
                </Col>
              </Row>
            </div>
          )}
        </ToolkitProvider>
      )}
    </PaginationProvider>
  )
}

const perCapitaHeaderFormatter = (column, colIndex, components) => {
  return (
    <>
      <div>{column.text}</div>
      <div>
        (per million)
        {components.sortElement}
        {components.filterElement}
      </div>
    </>
  )
}

const cumulatedHeaderFormatter = (column, colIndex, components) => {
  return (
    <>
      <div>{column.text}</div>
      <div>
        (on last day)
        {components.sortElement}
        {components.filterElement}
      </div>
    </>
  )
}

const perCapitaCellFormatter = cell => {
  if (!cell || isNaN(cell) || !isFinite(cell)) {
    return '--'
  }

  return cell.toLocaleString(LOCALE_DEFAULT)
}

const percentageHeaderFormatter = (column, colIndex, components) => {
  return (
    <>
      <div>{column.text}</div>
      <div>
        (%)
        {components.sortElement}
        {components.filterElement}
      </div>
    </>
  )
}

const normalHeaderFormatter = (column, colIndex, components) => {
  return (
    <>
      <div>{column.text}</div>
      <div>
        {components.sortElement}
        {components.filterElement}
      </div>
    </>
  )
}

const normalCellFormatter = cell => {
  if (!cell) {
    return '--'
  }

  return cell.toLocaleString(LOCALE_DEFAULT)
}

const columns = [
  {
    dataField: 'selected',
    text: 'Graph',
    sort: true,
    headerStyle: {width: '60px'},
    style: {textAlign: 'center'},
    headerFormatter: normalHeaderFormatter,
    formatter: (cell, row) => (
      <Form.Check
        custom
        type="checkbox"
        id={`select-${row.geoId}`}
        value={row.geoId}
        label=""
        onChange={e => action(ACTION_CHANGE_GEOID_SELECTION, {geoId: e.target.value, selected: e.target.checked})}
        checked={cell}
      />
    ),
  },
  {
    dataField: 'name',
    text: 'Country Name',
    headerFormatter: normalHeaderFormatter,
    sort: true,
  },
  {
    dataField: METRICS.CASES,
    text: 'Cases',
    sort: true,
    headerFormatter: normalHeaderFormatter,
    formatter: normalCellFormatter,
  },
  {
    dataField: METRICS.CASES_ACCUMULATED,
    text: 'Total cases',
    sort: true,
    headerFormatter: cumulatedHeaderFormatter,
    formatter: normalCellFormatter,
  },
  {
    dataField: METRICS.DEATHS,
    text: 'Deaths',
    sort: true,
    headerFormatter: normalHeaderFormatter,
    formatter: normalCellFormatter,
  },
  {
    dataField: METRICS.DEATHS_ACCUMULATED,
    text: 'Total deaths',
    sort: true,
    headerFormatter: cumulatedHeaderFormatter,
    formatter: normalCellFormatter,
  },
  {
    dataField: METRICS.INFECTION_PER_CAPITA,
    text: 'Incidence Rate',
    sort: true,
    headerFormatter: perCapitaHeaderFormatter,
    formatter: perCapitaCellFormatter,
  },
  {
    dataField: METRICS.MORTALITY_PER_CAPITA,
    text: 'Mortality Rate',
    sort: true,
    headerFormatter: perCapitaHeaderFormatter,
    formatter: perCapitaCellFormatter,
  },
  {
    dataField: METRICS.MORTALITY_PERCENTAGE,
    text: 'Case Fatality Ratio',
    sort: true,
    headerFormatter: percentageHeaderFormatter,
    formatter: normalCellFormatter,
  },
  {
    dataField: 'population',
    text: 'Population',
    sort: true,
    headerFormatter: normalHeaderFormatter,
    formatter: normalCellFormatter,
  },
]
