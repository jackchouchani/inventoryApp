import React, { memo } from 'react';
import { Dimensions } from 'react-native';
import { VictoryLine, VictoryChart, VictoryTheme, VictoryAxis, VictoryLegend } from 'victory';

interface StatsChartProps {
  data: {
    labels: string[];
    datasets: {
      data: number[];
      color: (opacity: number) => string;
      strokeWidth: number;
    }[];
    legend: string[];
  };
  width?: number;
  height?: number;
  onDataPointClick?: (index: number, x: number, y: number) => void;
}

const StatsChart: React.FC<StatsChartProps> = memo(({
  data,
  width = Dimensions.get('window').width - 40,
  height = 220,
  onDataPointClick
}) => {
  const formattedData = data.datasets.map((dataset, _i) => ({
    data: data.labels.map((label, index) => ({
      x: label,
      y: dataset.data[index]
    })),
    color: dataset.color(1)
  }));

  return (
    <VictoryChart
      width={width}
      height={height}
      theme={VictoryTheme.material}
      domainPadding={{ x: 20 }}
    >
      <VictoryAxis
        tickFormat={(t) => t}
        style={{
          tickLabels: { angle: -45, fontSize: 8 }
        }}
      />
      <VictoryAxis
        dependentAxis
        tickFormat={(t) => `${t}€`}
      />
      {formattedData.map((dataset, index) => (
        <VictoryLine
          key={index}
          data={dataset.data}
          style={{
            data: { stroke: dataset.color }
          }}
          events={onDataPointClick ? [{
            target: "data",
            eventHandlers: {
              onPress: () => [{
                target: "data",
                mutation: (props) => {
                  const { x, y, index } = props;
                  onDataPointClick(index, x, y);
                  return null;
                }
              }]
            }
          }] : []}
        />
      ))}
      <VictoryLegend
        x={width - 100}
        y={50}
        orientation="vertical"
        data={data.legend.map((label, i) => ({
          name: label,
          symbol: { fill: formattedData[i].color }
        }))}
      />
    </VictoryChart>
  );
});

StatsChart.displayName = 'StatsChart';

export { StatsChart }; 