import { useMemo } from 'react';

/**
 * Simple SVG Donut Chart Component
 */
export default function DonutChart({ data, size = 200, innerRadius = 0.6, outerRadius = 0.9 }) {
    const chartData = useMemo(() => {
        const total = data.reduce((acc, item) => acc + item.value, 0);
        if (total === 0) return [];

        let cumulative = 0;
        return data.map(item => {
            const percentage = item.value / total;
            const start = cumulative;
            cumulative += percentage;
            return {
                ...item,
                percentage,
                startAngle: start * 360,
                endAngle: cumulative * 360,
            };
        });
    }, [data]);

    const center = size / 2;
    const outer = (size / 2) * outerRadius;
    const inner = (size / 2) * innerRadius;

    // Convert polar to cartesian
    const polarToCartesian = (angle, radius) => {
        const rad = (angle - 90) * Math.PI / 180;
        return {
            x: center + radius * Math.cos(rad),
            y: center + radius * Math.sin(rad),
        };
    };

    // Create arc path
    const createArc = (startAngle, endAngle, outerR, innerR) => {
        const start = polarToCartesian(startAngle, outerR);
        const end = polarToCartesian(endAngle, outerR);
        const innerStart = polarToCartesian(endAngle, innerR);
        const innerEnd = polarToCartesian(startAngle, innerR);

        const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

        return [
            `M ${start.x} ${start.y}`,
            `A ${outerR} ${outerR} 0 ${largeArc} 1 ${end.x} ${end.y}`,
            `L ${innerStart.x} ${innerStart.y}`,
            `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
            'Z'
        ].join(' ');
    };

    if (chartData.length === 0) {
        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle
                    cx={center}
                    cy={center}
                    r={(outer + inner) / 2}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={outer - inner}
                />
            </svg>
        );
    }

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ filter: 'drop-shadow(0 4px 20px rgba(0, 217, 255, 0.2))' }}
        >
            <defs>
                {chartData.map((segment, i) => (
                    <linearGradient
                        key={`grad-${i}`}
                        id={`segment-grad-${i}`}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                    >
                        <stop offset="0%" stopColor={segment.color} stopOpacity="1" />
                        <stop offset="100%" stopColor={segment.color} stopOpacity="0.7" />
                    </linearGradient>
                ))}
            </defs>

            {chartData.map((segment, i) => {
                // Avoid rendering for very small segments
                if (segment.percentage < 0.01) return null;

                // Handle full circle case
                const angleDiff = segment.endAngle - segment.startAngle;
                if (angleDiff >= 359.99) {
                    return (
                        <g key={i}>
                            <circle
                                cx={center}
                                cy={center}
                                r={(outer + inner) / 2}
                                fill="none"
                                stroke={`url(#segment-grad-${i})`}
                                strokeWidth={outer - inner}
                            />
                        </g>
                    );
                }

                return (
                    <path
                        key={i}
                        d={createArc(segment.startAngle, segment.endAngle - 0.5, outer, inner)}
                        fill={`url(#segment-grad-${i})`}
                        style={{
                            transition: 'all 0.3s ease',
                            cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.filter = 'brightness(1.2)';
                            e.target.style.transform = 'scale(1.02)';
                            e.target.style.transformOrigin = 'center';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.filter = 'none';
                            e.target.style.transform = 'scale(1)';
                        }}
                    />
                );
            })}
        </svg>
    );
}
