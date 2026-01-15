import { AnalysisResult, CensusRow, RiskIssue } from '../types';

/**
 * Parses CSV text into an array of objects.
 */
export const parseCSV = (csvText: string): CensusRow[] => {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    // Handle commas inside quotes if necessary, but simple split for now
    const values = line.split(',');
    const row: any = {};
    headers.forEach((header, index) => {
      // Basic normalization of keys
      let key = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key.includes('id')) key = 'employeeId';
      else if (key.includes('annualsalary') || key === 'salary') key = 'annualSalary';
      // Expanded matching for DOB to include 'dateofbirth', 'birthdate', etc.
      else if (key.includes('dob') || key.includes('birth')) key = 'dob';
      else if (key.includes('status')) key = 'employmentStatus';
      else if (key.includes('hiredate')) key = 'hireDate';
      else if (key.includes('basic')) key = 'basicLifeCoverage';
      else if (key.includes('voluntary') || key.includes('supp')) key = 'voluntaryLifeMultiple';
      else if (key.includes('dependent')) key = 'dependentElections';
      
      row[key] = values[index]?.trim();
    });
    return row as CensusRow;
  });
};

/**
 * Constants for Scoring Logic
 */
const GI_LIMIT = 150000;
const PLAN_MAX_VOL_MULTIPLE = 5;
const WAITING_PERIOD_DAYS = 30;

// Penalties
const PENALTY_MISSING_SALARY = 5;
const PENALTY_MISSING_DOB = 4;
const PENALTY_VOL_OVER_MAX = 6;
const PENALTY_ZERO_SALARY_COV = 5;
const PENALTY_WAITING_PERIOD = 5;
const PENALTY_INELIGIBLE_DEP = 4;
const PENALTY_EOI_MISSING_SALARY = 3;

/**
 * Helper Functions
 */
const parseMoney = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Remove currency symbols and commas
  const clean = val.toString().replace(/[^0-9.-]+/g, "");
  return parseFloat(clean) || 0;
};

const isValidDate = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
};

const getDaysSince = (dateStr: string): number => {
    if (!isValidDate(dateStr)) return 9999; // Assume valid if date missing/invalid to avoid double counting if handled elsewhere
    const d = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
};

/**
 * Core Logic Engine
 */
export const analyzeCensusData = (rows: CensusRow[]): AnalysisResult => {
  const totalEmployees = rows.length;
  
  if (totalEmployees === 0) {
    return {
        overallScore: 0,
        riskLevel: 'High',
        totalEmployees: 0,
        subScores: {
          completeness: { name: 'Completeness', score: 0, issues: [] },
          consistency: { name: 'Consistency', score: 0, issues: [] },
          eligibility: { name: 'Eligibility', score: 0, issues: [] },
          eoiRisk: { name: 'EOI Risk', score: 0, issues: [] },
        },
        anomalies: [],
        executiveSummary: "No data found in file.",
        topRiskDrivers: [],
        predictedImpact: { clarifications: "0", eoiVolume: 0, postIssueCorrectionRisk: "None" },
        recommendedActions: []
      };
  }

  // --- 1. Iterate and Count Issues ---
  let missingSalaryCount = 0;
  let missingDobCount = 0;
  let volMultiOverMaxCount = 0;
  let zeroSalaryCount = 0;
  let waitingPeriodCount = 0;
  let ineligibleDepCount = 0; // Hard to detect without specific dependent DOB columns
  let employeesExceedingGI = 0;
  
  const employeeIdCounts = new Map<string, number>();
  let duplicateIdCount = 0;

  rows.forEach(row => {
    // Parsing
    const salary = parseMoney(row.annualSalary);
    const volMult = parseFloat(row.voluntaryLifeMultiple as string) || 0;
    const basicCov = parseMoney(row.basicLifeCoverage);
    
    // Completeness Checks
    const hasSalary = salary > 0;
    if (!hasSalary) missingSalaryCount++;
    if (!row.dob || !isValidDate(row.dob)) missingDobCount++;

    // Consistency Checks
    if (volMult > PLAN_MAX_VOL_MULTIPLE) volMultiOverMaxCount++;
    // Coverage elected (Vol > 0) but salary is missing/zero
    if (volMult > 0 && !hasSalary) zeroSalaryCount++;

    // Eligibility Checks
    // Waiting period
    if (row.hireDate && isValidDate(row.hireDate)) {
        if (getDaysSince(row.hireDate) < WAITING_PERIOD_DAYS) waitingPeriodCount++;
    }
    // Ineligible Dependents
    // NOTE: Without dependent DOBs in standard census, we might parse text or rely on provided counts.
    // For this generic logic, we check if 'dependentElections' exists but status is invalid, or just skip.
    // We will skip strictly counting this to avoid false positives unless specific data exists.
    
    // EOI Risk Checks
    // Calculate Total Volume: Basic + (Salary * VolMult)
    const totalVolume = basicCov + (salary * volMult);
    if (totalVolume > GI_LIMIT) employeesExceedingGI++;

    // Anomalies: Duplicates
    if (row.employeeId) {
        employeeIdCounts.set(row.employeeId, (employeeIdCounts.get(row.employeeId) || 0) + 1);
    }
  });

  // Count duplicates
  employeeIdCounts.forEach(count => {
      if (count > 1) duplicateIdCount += (count - 1); // Count excess
  });


  // --- 2. Calculate Sub-Scores ---

  // A. Completeness (30%)
  const rawCompletenessDeductions = (missingSalaryCount * PENALTY_MISSING_SALARY) + (missingDobCount * PENALTY_MISSING_DOB);
  let rawCompletenessScore = 100 - rawCompletenessDeductions;
  
  // Normalization
  const completenessErrorDensity = (missingSalaryCount + missingDobCount) / totalEmployees;
  let compDensityAdj = 0;
  if (completenessErrorDensity <= 0.05) compDensityAdj = 15;
  else if (completenessErrorDensity <= 0.10) compDensityAdj = 10;
  else compDensityAdj = 0;

  const completenessScore = Math.min(100, Math.max(0, rawCompletenessScore + compDensityAdj));

  // B. Consistency (25%)
  const rawConsistencyDeductions = (volMultiOverMaxCount * PENALTY_VOL_OVER_MAX) + (zeroSalaryCount * PENALTY_ZERO_SALARY_COV);
  const rawConsistencyScore = 100 - rawConsistencyDeductions;
  
  // "Reversed" Density Adjustment for Consistency
  const consistencyErrorCount = volMultiOverMaxCount + zeroSalaryCount;
  const consistencyErrorDensity = consistencyErrorCount / totalEmployees;
  
  let consDensityAdj = 0;
  if (consistencyErrorCount > 0) {
      if (consistencyErrorDensity <= 0.05) consDensityAdj = -9;
      else consDensityAdj = -15;
  }
  
  const consistencyScore = Math.min(100, Math.max(0, rawConsistencyScore + consDensityAdj));

  // C. Eligibility (25%)
  const eligibilityDeductions = (waitingPeriodCount * PENALTY_WAITING_PERIOD) + (ineligibleDepCount * PENALTY_INELIGIBLE_DEP);
  const eligibilityScore = Math.min(100, Math.max(0, 100 - eligibilityDeductions));

  // D. EOI Risk (20%)
  const eoiRatePercent = (employeesExceedingGI / totalEmployees) * 100;
  const eoiScoreRaw = 100 - (eoiRatePercent * 0.8) - (missingSalaryCount * PENALTY_EOI_MISSING_SALARY);
  const eoiScore = Math.min(100, Math.max(0, eoiScoreRaw));


  // --- 3. Final Weighted Score ---
  // (Comp * 0.3) + (Cons * 0.25) + (Elig * 0.25) + (EOI * 0.2)
  const weightedScore = (completenessScore * 0.30) + (consistencyScore * 0.25) + (eligibilityScore * 0.25) + (eoiScore * 0.20);
  const overallScore = Math.round(weightedScore);

  // Risk Level
  let riskLevel: 'Low' | 'Moderate' | 'High' = 'Moderate';
  if (overallScore >= 85) riskLevel = 'Low';
  else if (overallScore >= 70) riskLevel = 'Moderate';
  else riskLevel = 'High';


  // --- 4. Generate Output Artifacts ---

  const anomalies: RiskIssue[] = [];
  if (duplicateIdCount > 0) anomalies.push({ type: 'Duplicate IDs', count: duplicateIdCount, severity: 'High', description: 'Duplicate employee IDs found' });
  // Add simplified anomalies
  if (missingSalaryCount > totalEmployees * 0.1) anomalies.push({ type: 'Missing Salaries', count: missingSalaryCount, severity: 'High', description: 'High volume of missing salaries' });

  // Generate Risk Drivers dynamically
  const drivers = [];
  if (employeesExceedingGI > 0) drivers.push(`${employeesExceedingGI} employees exceed GI ($150k) → EOI required`);
  if (missingSalaryCount > 0) drivers.push(`${missingSalaryCount} missing salary records`);
  if (waitingPeriodCount > 0) drivers.push(`${waitingPeriodCount} employees in waiting period`);
  if (volMultiOverMaxCount > 0) drivers.push(`${volMultiOverMaxCount} coverage elections exceeding plan max (5x)`);
  if (duplicateIdCount > 0) drivers.push(`${duplicateIdCount} duplicate IDs`);

  // Simple impact prediction logic
  const eoiVol = Math.ceil(employeesExceedingGI * 1.1); // Add buffer
  const clarificationCycles = overallScore < 70 ? "6+" : overallScore < 85 ? "4–6" : "1-2";
  const postIssueRisk = overallScore < 70 ? "High" : overallScore < 85 ? "Medium" : "Low";

  // Actions
  const actions = [];
  if (missingSalaryCount > 0) actions.push({ area: "Missing Salary", recommendation: "Employer clarification upfront" });
  if (employeesExceedingGI > 0) actions.push({ area: "EOI Volume", recommendation: "Pre-emptive EOI communication" });
  if (duplicateIdCount > 0) actions.push({ area: "Duplicates", recommendation: "Deduplicate before enrollment" });
  if (volMultiOverMaxCount > 0) actions.push({ area: "Plan Limits", recommendation: "Cap voluntary elections at 5x" });
  if (actions.length === 0) actions.push({ area: "General", recommendation: "Proceed to enrollment" });

  const summary = `This census demonstrates ${riskLevel.toLowerCase()} enrollment risk (Score: ${overallScore}). Primary drivers include ${employeesExceedingGI} EOI cases and ${missingSalaryCount} missing data points.`;

  return {
    overallScore,
    riskLevel,
    totalEmployees,
    subScores: {
      completeness: {
        name: 'Completeness',
        score: Math.round(completenessScore),
        issues: [
          { type: 'Missing Salary', count: missingSalaryCount, severity: 'High', description: 'Salary field is empty or null' },
          { type: 'Missing DOB', count: missingDobCount, severity: 'Medium', description: 'Date of birth missing' }
        ]
      },
      consistency: {
        name: 'Consistency',
        score: Math.round(consistencyScore),
        issues: [
          { type: 'Voluntary > Max', count: volMultiOverMaxCount, severity: 'High', description: 'Voluntary multiple > plan max (5x)' },
          { type: 'Zero Salary Coverage', count: zeroSalaryCount, severity: 'High', description: 'Coverage elected with $0 salary' }
        ]
      },
      eligibility: {
        name: 'Eligibility',
        score: Math.round(eligibilityScore),
        issues: [
          { type: 'Waiting Period', count: waitingPeriodCount, severity: 'Medium', description: 'Employees in waiting period (<30 days)' },
          { type: 'Ineligible Dependents', count: ineligibleDepCount, severity: 'Medium', description: 'Dependents exceeding age limits (Note: Data unavailable)' }
        ]
      },
      eoiRisk: {
        name: 'EOI Risk',
        score: Math.round(eoiScore),
        issues: [
          { type: 'Exceeding GI', count: employeesExceedingGI, severity: 'High', description: 'Employees exceeding Guaranteed Issue ($150k)' },
          { type: 'EOI Rate', count: Math.round(eoiRatePercent), severity: 'Medium', description: '% of group requiring EOI' }
        ]
      }
    },
    anomalies,
    executiveSummary: summary,
    topRiskDrivers: drivers.slice(0, 5), // Top 5
    predictedImpact: {
      clarifications: clarificationCycles + " cycles",
      eoiVolume: eoiVol,
      postIssueCorrectionRisk: postIssueRisk
    },
    recommendedActions: actions
  };
};