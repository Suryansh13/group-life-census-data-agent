export interface CensusRow {
  employeeId: string;
  name: string;
  dob: string;
  employmentStatus: string;
  hireDate: string;
  annualSalary: number | string;
  basicLifeCoverage: number | string;
  voluntaryLifeMultiple: number | string;
  dependentElections: string;
}

export interface RiskIssue {
  type: string;
  count: number;
  severity: 'Low' | 'Medium' | 'High';
  description: string;
}

export interface SubScore {
  name: string;
  score: number;
  issues: RiskIssue[];
}

export interface AnalysisResult {
  overallScore: number;
  riskLevel: 'Low' | 'Moderate' | 'High';
  totalEmployees: number;
  subScores: {
    completeness: SubScore;
    consistency: SubScore;
    eligibility: SubScore;
    eoiRisk: SubScore;
  };
  anomalies: RiskIssue[];
  executiveSummary: string;
  topRiskDrivers: string[];
  predictedImpact: {
    clarifications: string;
    eoiVolume: number;
    postIssueCorrectionRisk: string;
  };
  recommendedActions: {
    area: string;
    recommendation: string;
  }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isSystem?: boolean;
}