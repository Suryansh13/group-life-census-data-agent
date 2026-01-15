import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import { AnalysisResult, ChatMessage } from './types';
import { analyzeCensusData, parseCSV } from './services/analysisService';
import { generateChatResponse } from './services/geminiService';

const INITIAL_MESSAGE: ChatMessage = {
  id: '1',
  role: 'model',
  text: "Hello! I am your Census Quality Scoring Agent. Please upload your employee census file (Excel or CSV) to begin the risk analysis and quality scoring process.",
  timestamp: new Date()
};

function App() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle standard text messages
  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    // Call Gemini
    const aiResponseText = await generateChatResponse(
      messages.map(m => ({ role: m.role, text: m.text })), 
      text, 
      analysisResult || undefined
    );

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: aiResponseText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsProcessing(false);
  };

  // Handle file upload and analysis trigger
  const handleFileUpload = async (file: File) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: `Uploaded file: ${file.name}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // 1. Simulate reading/parsing the file
      const text = await file.text();
      const rows = parseCSV(text);

      // 2. Run deterministic analysis (The hardcoded logic for demo)
      // Note: We are passing a dummy row array if parsing fails or just to trigger the "75-employee" scenario logic
      // In a real app, `rows` would be real data.
      const result = analyzeCensusData(rows.length > 0 ? rows : [{} as any]); 
      
      // 3. Update State
      setAnalysisResult(result);

      // 4. Generate AI summary of the analysis
      const aiResponseText = await generateChatResponse(
        messages.map(m => ({ role: m.role, text: m.text })), 
        "I have uploaded the file. Please analyze it and give me the Executive Summary.", 
        result
      );

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: aiResponseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error("File processing error", error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "I encountered an error reading that file. Please ensure it is a valid CSV or Excel file.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      
      {/* Main Content Area - Dashboard */}
      <div className="flex-grow h-full overflow-hidden relative">
        {analysisResult ? (
          <Dashboard data={analysisResult} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-200 max-w-2xl">
              <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M8 15l4 3 4-3"/></svg>
              </div>
              <h1 className="text-3xl font-bold text-slate-800 mb-4">Census Quality Scoring Agent</h1>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Upload your group life insurance census to get an instant quality score, EOI risk prediction, and operational recommendations.
              </p>
              
              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <h3 className="font-semibold text-gray-800 mb-1">Detect Risks</h3>
                  <p className="text-xs text-gray-500">Finds missing salaries, invalid DOBs, and consistency errors.</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <h3 className="font-semibold text-gray-800 mb-1">Predict EOI</h3>
                  <p className="text-xs text-gray-500">Estimates volume of employees exceeding Guaranteed Issue.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Side Chat Interface */}
      <ChatInterface 
        messages={messages} 
        onSendMessage={handleSendMessage} 
        onFileUpload={handleFileUpload}
        isProcessing={isProcessing}
      />
    </div>
  );
}

export default App;