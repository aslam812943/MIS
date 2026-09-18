import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
export default function FranchiseSalesChart({ title, rows, type = 'bar', valueLabel = 'Sales amount (INR)', integer = false, emptyMessage = 'No sales recorded for these filters.' }: { title: string; rows: {label:string;amount:number}[]; type?: 'bar' | 'line' | 'doughnut'; valueLabel?: string; integer?: boolean; emptyMessage?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current || !rows.length) return;
    let chart: Chart;
    const draw = () => {
      chart?.destroy();
      const color = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#94a3b8';
      chart = new Chart(canvas.current!, { type, data: { labels: rows.map(r=>r.label), datasets: [{ label: valueLabel, data: rows.map(r=>r.amount), backgroundColor: type === 'doughnut' ? ['#14b8a6','#3b82f6','#f59e0b','#8b5cf6','#06b6d4','#f43f5e','#84cc16','#ec4899','#64748b'] : '#14b8a6', borderColor: '#14b8a6', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: type === 'doughnut', labels: { color } } }, ...(type !== 'doughnut' ? { scales: { x: { ticks: { color } }, y: { beginAtZero: true, ticks: { color, ...(integer ? { precision: 0 } : {}) } } } } : {}) } });
    };
    draw(); const observer = new MutationObserver(draw); observer.observe(document.documentElement, {attributes:true,attributeFilter:['class','data-theme','style']});
    return () => { observer.disconnect(); chart?.destroy(); };
  }, [rows, type, valueLabel, integer]);
  return <section className="fr-panel"><div className="fr-panel-head"><h2>{title}</h2></div><div className="fr-chart">{rows.length ? <canvas ref={canvas} role="img" aria-label={title}/> : <p className="fr-empty">{emptyMessage}</p>}</div></section>;
}
