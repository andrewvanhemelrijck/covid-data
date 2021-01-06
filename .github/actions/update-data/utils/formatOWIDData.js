function isPercentageField(field) {
  return (
    field === 'positive_rate'
    || field === 'total_vaccinations_per_hundred'
  );
}

const dataPointHFLegendOWID = {
  // active: 'Active Cases',
  total_cases: 'Total Cases',
  // critical: 'Critical Cases',
  total_deaths: 'Total Deaths',
  // recovered: 'Total Recovered',
  new_tests: 'New Tests',
  total_tests: 'Tests',
  new_cases: 'New Cases',
  new_deaths: 'New Deaths',
  positive_rate: 'Positive Tests (%)',
  tests_per_case: 'Tests Per Case',
  total_vaccinations: 'Total Vaccinations',
  total_vaccinations_per_hundred: 'Vaccination (%)',
};

function formatDataPoints({ entry: { date, ...dataPoints }, population }) {
  const formattedDataPoints = {};

  Object
    .keys(dataPointHFLegendOWID)
    .forEach((key) => {
      if (!dataPoints[key] && dataPoints[key]!== 0) return;

      if (!isPercentageField(key) && key !== 'tests_per_case') {
        let perThousandValue = dataPoints[`${key}_per_million`] / 1000;
        if (key === 'total_vaccinations') perThousandValue = dataPoints[key] / population * 10;
        else if (key.includes('tests')) perThousandValue = dataPoints[`${key}_per_thousand`];

        formattedDataPoints[key + '_per_thousand'] = perThousandValue;
        formattedDataPoints[key + '_per_thousand_updated'] = date;
      }

      let dataValue = dataPoints[key];
      if (key === 'positive_rate') dataValue = dataPoints[key] * 100;

      formattedDataPoints[key] = dataValue;
      formattedDataPoints[key + '_updated'] = date;
    });
  
  return formattedDataPoints;
}

module.exports = function formatOWIDData(owidData) {
  const constituents = {};
  let topLevelTotals;

  Object.entries(owidData).forEach(([isoA3, { data, location, population }]) => {
    let totals = {};
    const formattedTimeseries = data.map((entry) => {
      const formattedEntry = formatDataPoints({ entry, population });
      totals = {
        ...totals,
        ...formattedEntry,
      };

      return formattedEntry;
    });

    const fullLocationData = {
      location,
      // timeseries: formattedTimeseries,
      ...totals,
    };

    if (isoA3 === 'OWID_WRL') topLevelTotals = fullLocationData;
    else constituents[isoA3] = fullLocationData;
  });

  return {
    ...topLevelTotals,
    constituents,
  };
}