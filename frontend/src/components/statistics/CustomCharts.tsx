import React from 'react'
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'

// ============================================================================
// Progress Ring Component
// ============================================================================

interface ProgressRingProps {
  value: number
  maxValue: number
  size?: number
  strokeWidth?: number
  color?: string
  backgroundColor?: string
  label?: string
  sublabel?: string
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  maxValue,
  size = 80,
  strokeWidth = 8,
  color = '#059669',
  backgroundColor = '#e5e7eb',
  label,
  sublabel
}) => {
  const percentage = Math.min((value / maxValue) * 100, 100)
  
  return (
    <div style={{ 
      width: size, 
      height: size, 
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <CircularProgressbar
        value={percentage}
        styles={buildStyles({
          pathColor: color,
          trailColor: backgroundColor,
          strokeLinecap: 'round',
          pathTransitionDuration: 1,
        })}
        strokeWidth={strokeWidth}
      />
      {label && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            lineHeight: 1
          }}>
            {label}
          </div>
          {sublabel && (
            <div style={{
              fontSize: '10px',
              color: '#6b7280',
              marginTop: '2px'
            }}>
              {sublabel}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Simple Bar Chart Component
// ============================================================================

interface BarChartData {
  name: string
  value: number
  color?: string
}

interface SimpleBarChartProps {
  data: BarChartData[]
  height?: number
  maxValue?: number
  showValues?: boolean
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  height = 200,
  maxValue,
  showValues = true
}) => {
  const max = maxValue || Math.max(...data.map(d => d.value))
  const barWidth = Math.max(20, (100 / data.length) - 2)
  
  return (
    <div style={{ width: '100%', height }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {data.map((item, index) => {
          const barHeight = (item.value / max) * 80
          const x = (index * (100 / data.length)) + ((100 / data.length) - barWidth) / 2
          const y = 90 - barHeight
          
          return (
            <g key={index}>
              <rect
                x={`${x}%`}
                y={`${y}%`}
                width={`${barWidth}%`}
                height={`${barHeight}%`}
                fill={item.color || '#059669'}
                rx="2"
              />
              {showValues && (
                <text
                  x={`${x + barWidth/2}%`}
                  y={`${y - 2}%`}
                  textAnchor="middle"
                  fontSize="3"
                  fill="#374151"
                  fontWeight="600"
                >
                  {item.value}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        marginTop: '8px',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        {data.map((item, index) => (
          <span key={index} style={{ textAlign: 'center', flex: 1 }}>
            {item.name}
          </span>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Simple Line Chart Component
// ============================================================================

interface LineChartData {
  name: string
  value: number
}

interface SimpleLineChartProps {
  data: LineChartData[]
  height?: number
  color?: string
  showDots?: boolean
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  data,
  height = 200,
  color = '#059669',
  showDots = true
}) => {
  if (data.length === 0) return null
  
  const maxValue = Math.max(...data.map(d => d.value))
  const minValue = Math.min(...data.map(d => d.value))
  const range = maxValue - minValue || 1
  
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 90 + 5
    const y = 85 - ((item.value - minValue) / range) * 70
    return `${x},${y}`
  }).join(' ')
  
  return (
    <div style={{ width: '100%', height }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100">
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#f3f4f6" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          points={points}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Dots */}
        {showDots && data.map((item, index) => {
          const x = (index / (data.length - 1)) * 90 + 5
          const y = 85 - ((item.value - minValue) / range) * 70
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="1.5"
              fill={color}
              stroke="white"
              strokeWidth="1"
            />
          )
        })}
      </svg>
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '10px',
        color: '#6b7280'
      }}>
        <span>{data[0]?.name}</span>
        <span>{data[data.length - 1]?.name}</span>
      </div>
    </div>
  )
}

// ============================================================================
// Heatmap Component
// ============================================================================

interface HeatmapData {
  date: string
  value: number
}

interface HeatmapProps {
  data: HeatmapData[]
  weeks?: number
  cellSize?: number
  colors?: string[]
}

export const Heatmap: React.FC<HeatmapProps> = ({
  data,
  weeks = 12,
  cellSize = 12,
  colors = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']
}) => {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - (weeks * 7))
  
  const dataMap = new Map(data.map(d => [d.date, d.value]))
  const maxValue = Math.max(...data.map(d => d.value), 1)
  
  const getColorForValue = (value: number) => {
    if (value === 0) return colors[0]
    const intensity = Math.ceil((value / maxValue) * (colors.length - 1))
    return colors[Math.min(intensity, colors.length - 1)]
  }
  
  interface HeatmapCell {
    x: number
    y: number
    value: number
    date: string
    color: string
  }
  
  const cells: HeatmapCell[] = []
  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + (week * 7) + day)
      
      if (date <= today) {
        const dateStr = date.toISOString().split('T')[0]
        const mapValue = dataMap.get(dateStr)
        const value: number = typeof mapValue === 'number' ? mapValue : 0
        
        cells.push({
          x: week * (cellSize + 2),
          y: day * (cellSize + 2),
          value,
          date: dateStr,
          color: getColorForValue(value)
        })
      }
    }
  }
  
  return (
    <div style={{ 
      width: '100%', 
      overflowX: 'auto',
      padding: '8px 0'
    }}>
      <svg 
        width={weeks * (cellSize + 2)} 
        height={7 * (cellSize + 2)}
        style={{ minWidth: '300px' }}
      >
        {cells.map((cell, index) => (
          <rect
            key={index}
            x={cell.x}
            y={cell.y}
            width={cellSize}
            height={cellSize}
            fill={cell.color}
            rx="2"
            title={`${cell.date}: ${cell.value}`}
          />
        ))}
      </svg>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '10px',
        color: '#6b7280'
      }}>
        <span>Less</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {colors.map((color, index) => (
            <div
              key={index}
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: color,
                borderRadius: '2px'
              }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  )
}

export default {
  ProgressRing,
  SimpleBarChart,
  SimpleLineChart,
  Heatmap
}