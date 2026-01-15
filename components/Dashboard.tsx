import React, { useRef, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { AlertTriangle, CheckCircle, AlertOctagon, FileText, Activity, Users, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { AnalysisResult, SubScore } from '../types';

interface DashboardProps {
  data: AnalysisResult;
}

const ScoreGauge = ({ score }: { score: number }) => {
  const getColor = (s: number) => {
    if (s >= 90) return 'text-green-600';
    if (s >= 75) return 'text-yellow-600';
    if (s >= 60) return 'text-orange-500';
    return 'text-red-600';
  };

  const getLabel = (s: number) => {
    if (s >= 90) return 'Clean, Low Risk';
    if (s >= 75) return 'Minor Issues';
    if (s >= 60) return 'Moderate Risk';
    return 'High Risk';
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-sm border border-gray-200 h-full">
      <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider mb-2">Overall Census Quality</h3>
      <div className={`text-6xl font-bold ${getColor(score)}`}>{score}</div>
      <div className={`text-lg font-medium mt-1 ${getColor(score)}`}>{getLabel(score)}</div>
      <div className="text-xs text-gray-400 mt-4">Target: >90</div>
    </div>
  );
};

const SubScoreCard = ({ subScore, icon: Icon }: { subScore: SubScore; icon: any }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
    <div className="flex justify-between items-start mb-3">
      <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
        <Icon size={20} />
      </div>
      <span className={`text-lg font-bold ${subScore.score < 75 ? 'text-red-500' : 'text-gray-700'}`}>
        {subScore.score}/100
      </span>
    </div>
    <h4 className="font-semibold text-gray-800 mb-2">{subScore.name}</h4>
    <div className="space-y-2 flex-grow">
      {subScore.issues.map((issue, idx) => (
        <div key={idx} className="flex items-start text-xs text-gray-600 bg-gray-50 p-2 rounded">
          <span className={`w-2 h-2 mt-1 mr-2 rounded-full flex-shrink-0 ${issue.severity === 'High' ? 'bg-red-500' : 'bg-yellow-400'}`}></span>
          <span>{issue.count} {issue.description}</span>
        </div>
      ))}
    </div>
  </div>
);

const ImpactSummary = ({ impact }: { impact: AnalysisResult['predictedImpact'] }) => (
  <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg h-full flex flex-col justify-center">
    <h3 className="font-semibold text-slate-200 mb-4 flex items-center">
      <Activity size={18} className="mr-2" /> Predicted Downstream Impact
    </h3>
    <div className="grid grid-cols-3 gap-4">
      <div>
        <div className="text-2xl font-bold text-blue-400">{impact.clarifications}</div>
        <div className="text-xs text-slate-400">Clarification Cycles</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-orange-400">{impact.eoiVolume}</div>
        <div className="text-xs text-slate-400">Est. EOI Volume</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-red-400">{impact.postIssueCorrectionRisk}</div>
        <div className="text-xs text-slate-400">Post-Issue Risk</div>
      </div>
    </div>
  </div>
);

const RecommendedActions = ({ actions }: { actions: AnalysisResult['recommendedActions'] }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full">
    <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
      <CheckCircle size={18} className="mr-2 text-green-600" /> Recommended Actions
    </h3>
    <div className="space-y-3">
      {actions.map((action, idx) => (
        <div key={idx} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0">
          <span className="text-sm font-medium text-gray-700">{action.area}</span>
          <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
            {action.recommendation}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const radarData = [
    { subject: 'Completeness', A: data.subScores.completeness.score, fullMark: 100 },
    { subject: 'Consistency', A: data.subScores.consistency.score, fullMark: 100 },
    { subject: 'Eligibility', A: data.subScores.eligibility.score, fullMark: 100 },
    { subject: 'EOI Risk', A: data.subScores.eoiRisk.score, fullMark: 100 },
  ];

  const handleDownload = async () => {
    if (!dashboardRef.current) return;
    
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2, // Better resolution
        backgroundColor: '#f8fafc',
      });
      
      const link = document.createElement('a');
      link.download = `Census-Risk-Report-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Download failed', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto bg-slate-50">
        <div ref={dashboardRef} className="p-6 space-y-6 pb-32">
          
          {/* Header Info */}
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Census Analysis Report</h1>
              <p className="text-sm text-slate-500 mt-1">Status: {data.riskLevel} Risk • {data.totalEmployees} Employees Processed</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Automated Scoring Agent
              </span>
            </div>
          </div>

          {/* Top Row: Score + Radar + Impact */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            <div className="md:col-span-3">
              <ScoreGauge score={data.overallScore} />
            </div>
            <div className="md:col-span-4 bg-white rounded-xl shadow-sm border border-gray-200 p-2 h-full flex flex-col justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis 
                      dataKey="subject" 
                      tick={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} 
                    />
                    <PolarRadiusAxis 
                      angle={30} 
                      domain={[0, 100]} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }}
                      stroke="#e5e7eb"
                    />
                    <Radar name="Score" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.4} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
            </div>
            <div className="md:col-span-5 flex flex-col justify-between space-y-4 h-full">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex-grow">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Executive Summary</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{data.executiveSummary}</p>
              </div>
              <div className="h-auto">
                <ImpactSummary impact={data.predictedImpact} />
              </div>
            </div>
          </div>

          {/* Sub Scores Grid */}
          <h3 className="text-lg font-semibold text-gray-800">Deep Dive Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SubScoreCard subScore={data.subScores.completeness} icon={FileText} />
            <SubScoreCard subScore={data.subScores.consistency} icon={AlertOctagon} />
            <SubScoreCard subScore={data.subScores.eligibility} icon={Users} />
            <SubScoreCard subScore={data.subScores.eoiRisk} icon={AlertTriangle} />
          </div>

          {/* Bottom Row: Risk Drivers & Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                <AlertTriangle size={18} className="mr-2 text-red-500" /> Top Risk Drivers
              </h3>
              <ul className="space-y-3">
                {data.topRiskDrivers.map((driver, idx) => (
                  <li key={idx} className="flex items-start text-sm text-gray-700">
                    <span className="text-red-500 mr-2">•</span> {driver}
                  </li>
                ))}
              </ul>
            </div>
            <div className="h-full">
              <RecommendedActions actions={data.recommendedActions} />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Download Button */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20 pointer-events-none">
        <button 
          onClick={handleDownload}
          disabled={isDownloading}
          className="pointer-events-auto flex items-center space-x-2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl hover:bg-slate-800 transition-all transform hover:scale-105 disabled:opacity-70 disabled:scale-100"
        >
          {isDownloading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Download size={20} />
          )}
          <span className="font-medium">Download Report View</span>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;