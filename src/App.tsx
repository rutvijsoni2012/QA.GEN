/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, ChangeEvent, ClipboardEvent } from "react";
import { GoogleGenAI } from "@google/genai";
import { 
  Play, 
  Settings, 
  FileCode, 
  ShieldAlert, 
  RefreshCw, 
  CheckCircle2, 
  Copy, 
  ExternalLink,
  ChevronRight,
  Terminal,
  BrainCircuit,
  Database,
  User as UserIcon,
  Globe,
  Plus,
  Upload,
  Trash2,
  FileVideo,
  FileImage
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types
interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password?: string;
}

interface ScriptResponse {
  id: string;
  title: string;
  timestamp: string;
  pomClasses: { fileName: string; content: string }[];
  testScript: { fileName: string; content: string };
  explanation: string;
}

interface Project {
  id: string;
  name: string;
  config: OdooConfig;
  scripts: ScriptResponse[];
  createdAt: string;
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem("odoo_qa_projects");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    return localStorage.getItem("odoo_qa_active_project") || null;
  });
  const [activeScriptId, setActiveScriptId] = useState<string | null>(() => {
    return localStorage.getItem("odoo_qa_active_script") || null;
  });

  const [testSteps, setTestSteps] = useState("");
  const [functionalRequirements, setFunctionalRequirements] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"positive" | "negative">("positive");
  const [generatedScript, setGeneratedScript] = useState<ScriptResponse | null>(null);
  const [feedback, setFeedback] = useState("");
  const [lastFeedback, setLastFeedback] = useState("");
  const [feedbackAttempts, setFeedbackAttempts] = useState(0);
  const [tutorSolution, setTutorSolution] = useState<string | null>(null);
  const [isSolving, setIsSolving] = useState(false);
  const [changedFiles, setChangedFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [mediaFiles, setMediaFiles] = useState<{ data: string; mimeType: string; name: string }[]>([]);
  const [feedbackMediaFiles, setFeedbackMediaFiles] = useState<{ data: string; mimeType: string; name: string }[]>([]);
  const [showGuide, setShowGuide] = useState(false);

  const aiRef = useRef<GoogleGenAI | null>(null);

  useEffect(() => {
    aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }, []);

  useEffect(() => {
    localStorage.setItem("odoo_qa_projects", JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem("odoo_qa_active_project", activeProjectId);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (activeScriptId) {
      localStorage.setItem("odoo_qa_active_script", activeScriptId);
    } else {
      localStorage.removeItem("odoo_qa_active_script");
    }
  }, [activeScriptId]);

  useEffect(() => {
    if (!feedback) {
      setFeedbackAttempts(0);
      setLastFeedback("");
    }
  }, [feedback]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  useEffect(() => {
    if (activeProject && !generatedScript && activeScriptId) {
      const savedScript = activeProject.scripts.find(s => s.id === activeScriptId);
      if (savedScript) {
        setGeneratedScript(savedScript);
      }
    } else if (activeProject && !generatedScript && activeProject.scripts.length > 0 && !activeScriptId) {
       // Fallback to latest script if no active script id is saved
       setGeneratedScript(activeProject.scripts[0]);
       setActiveScriptId(activeProject.scripts[0].id);
    }
  }, [activeProject, activeScriptId, generatedScript]);

  const setConfig = (newConfig: OdooConfig) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => 
      p.id === activeProjectId ? { ...p, config: newConfig } : p
    ));
  };

  const createProject = () => {
    if (!newProjectName.trim()) return;
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: newProjectName,
      config: { url: "", db: "", username: "", password: "" },
      scripts: [],
      createdAt: new Date().toISOString()
    };
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    setNewProjectName("");
    setIsAddingProject(false);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = await Promise.all(Array.from(files).map(async (file: File) => {
      return new Promise<{ data: string; mimeType: string; name: string }>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({
            data: base64,
            mimeType: file.type,
            name: file.name
          });
        };
        reader.readAsDataURL(file);
      });
    }));

    setMediaFiles(prev => [...prev, ...newFiles]);
  };

  const removeMediaFile = (name: string) => {
    setMediaFiles(prev => prev.filter(f => f.name !== name));
  };

  const handleFeedbackFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = await Promise.all(Array.from(files).map(async (file: File) => {
      return new Promise<{ data: string; mimeType: string; name: string }>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({
            data: base64,
            mimeType: file.type,
            name: file.name
          });
        };
        reader.readAsDataURL(file);
      });
    }));

    setFeedbackMediaFiles(prev => [...prev, ...newFiles]);
  };

  const handleFeedbackPaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length === 0) return;

    const newFiles = await Promise.all(files.map(async (file: File) => {
      return new Promise<{ data: string; mimeType: string; name: string }>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({
            data: base64,
            mimeType: file.type,
            name: `pasted-image-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
          });
        };
        reader.readAsDataURL(file);
      });
    }));

    setFeedbackMediaFiles(prev => [...prev, ...newFiles]);
  };

  const removeFeedbackMediaFile = (name: string) => {
    setFeedbackMediaFiles(prev => prev.filter(f => f.name !== name));
  };

  const solveProblem = async () => {
    if (!aiRef.current || !activeProject || !feedback) return;
    setIsSolving(true);
    setTutorSolution(null);
    setError(null);

    const isRepeating = feedback === lastFeedback;
    const currentAttempt = isRepeating ? feedbackAttempts + 1 : 1;
    setFeedbackAttempts(currentAttempt);
    setLastFeedback(feedback);

    const recentHistory = activeProject.scripts.slice(0, 3).map((s, i) => 
      `ATTEMPT ${i + 1}:\n${s.explanation.substring(0, 500)}...`
    ).join("\n\n");

    const prompt = `
      As a Senior Odoo QA Automation Expert, solve the following automation task.
      
      CONTEXT:
      Odoo URL: ${activeProject.config.url}
      CURRENT ATTEMPT FOR THIS ISSUE: ${currentAttempt}
      
      ${recentHistory ? `RECENT HISTORY OF GENERATED SCRIPTS:\n${recentHistory}` : ""}

      USER INPUT/PROBLEM:
      ${feedback}
      
      ${feedbackMediaFiles.length > 0 ? "I have attached screenshots of the error/issue." : "No screenshots attached."}

      SMART TUTOR INSTRUCTIONS (ITERATIVE LEARNING):
      1. ANALYZE PREVIOUS FAILURES: If this is ATTEMPT 2 or higher, it means your previous solution likely failed. DO NOT repeat the same approach. Try a more robust locator strategy (e.g., using data-attributes, relative XPath, or handling dynamic overlays).
      2. DIAGNOSTIC MODE (CRITICAL): If this is ATTEMPT 3 or higher, switch your focus: 
         - Provide a set of diagnostic steps for the user (e.g., "Run this command to inspect elements", "Check this specific Odoo log").
         - Offer to simplify the test if the current scenario is too flaky.
      3. DETECT INTENT:
         - If code is provided, return ONLY the corrected code block. No explanation.
         - If a problem description is provided, explain the root cause and provide a fix.
      4. SCOPE: Provide ONLY the targeted fix.
    `;

    try {
      const response = await aiRef.current.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: {
          role: "user",
          parts: [
            { text: prompt },
            ...feedbackMediaFiles.map(file => ({
              inlineData: {
                data: file.data,
                mimeType: file.mimeType
              }
            }))
          ]
        }
      });

      setTutorSolution(response.text || "No solution generated.");
    } catch (err) {
      console.error(err);
      setError("Failed to generate solution. Please try again.");
    } finally {
      setIsSolving(false);
    }
  };

  const generateScript = async (mode: "positive" | "negative") => {
    if (!aiRef.current || !activeProject) return;
    setIsGenerating(true);
    setError(null);
    setActiveTab(mode);

    // Shared internal tracker for attempts
    const isRepeating = feedback === lastFeedback;
    const currentAttempt = isRepeating ? feedbackAttempts + 1 : 1;
    setFeedbackAttempts(currentAttempt);
    setLastFeedback(feedback);
    
    // Collect all unique POM classes from previous scripts in this project
    const existingPOMContext = activeProject.scripts.reduce((acc, script) => {
      script.pomClasses.forEach(pom => {
        if (!acc[pom.fileName]) {
          acc[pom.fileName] = pom.content;
        }
      });
      return acc;
    }, {} as Record<string, string>);

    const pomContextString = Object.entries(existingPOMContext)
      .map(([fileName, content]) => `FILE: ${fileName}\nCONTENT:\n${content}`)
      .join("\n\n---\n\n");

    const isUpdating = !!feedback || !!tutorSolution;

    const prompt = `
      As a Senior Odoo QA Automation Expert and Pro Tutor, generate a Playwright automation script using the Page Object Model (POM) pattern.
      
      CONTEXT:
      Odoo Version: Latest (v17/18)
      Odoo URL: ${activeProject.config.url}
      Odoo Database: ${activeProject.config.db}
      Username: ${activeProject.config.username}
      Password: ${activeProject.config.password || "Not provided"}
      
      EXISTING PROJECT POM CLASSES (REUSE THESE IF APPLICABLE):
      ${pomContextString || "No existing POM classes yet."}

      TARGET SCENARIO (${mode === "positive" ? "Happy Path" : "Negative/Edge Cases"}):
      Title: ${testSteps.split('\n')[0].substring(0, 50) || "New Test Scenario"}
      Test Steps: ${testSteps}
      Functional Requirements: ${functionalRequirements}
      
      ${feedback ? `REWRITE BASED ON FEEDBACK (Attempt ${feedback === lastFeedback ? feedbackAttempts + 1 : 1}): ${feedback}` : ""}
      ${tutorSolution ? `PROPOSED SOLUTION TO INCORPORATE: ${tutorSolution}` : ""}
      
      ITERATIVE RULES:
      1. If this is a repeat adjustment for the same feedback, avoid using the same locators or logic from the existing POM classes provided in context. 
      2. If you are stuck after 3 attempts, prioritize adding "TODO: FIND THIS" comments with diagnostic hints for the user.
      
      MULTIMODAL CONTEXT (MAIN SCENARIO):
      ${mediaFiles.length > 0 ? "I have attached images/videos of the functional flow. Please analyze them carefully." : "No visual media attached for main scenario."}

      FEEDBACK CONTEXT (MEDIA ATTACHED TO FEEDBACK):
      ${feedbackMediaFiles.length > 0 ? "I have also attached screenshots/images specifically related to my feedback (e.g., error messages, UI issues). Use these to understand the correction I am asking for." : "No visual media attached for feedback."}

      REQUIREMENTS:
      1. ${isUpdating 
        ? "TARGETED UPDATES: Since this is an adjustment based on feedback, ONLY return files that REQUIRE modifications. OMIT unchanged files from the JSON response." 
        : "FULL FILE SET: This is an initial generation. You MUST provide the FULL content of ALL Page Object classes and the Test Script required for the test to function."}
      2. PROJECT STRUCTURE: Assume the following directory structure for imports:
         - Spec files should be in the 'tests/' directory.
         - POM classes should be in the 'pages/' directory.
         Test scripts should import pages using: "import { ... } from '../pages/...'"
      3. REUSE EXISTING CLASSES: If a POM class already exists in the context that covers a page (e.g., LoginPage, SalesPage), use its methods or extend it. Do NOT duplicate logic.
      4. CONSISTENCY: Maintain the same naming conventions and locator strategies as the existing classes.
      5. CREDENTIALS INJECTION: You MUST explicitly include the provided Odoo URL, Database, Username, and Password in the generated test script (e.g., in a config object or beforeEach block) so the script is runnable immediately.
      6. UNKNOWN LOCATORS: If a locator, field name, or UI interaction is uncertain (even with video context), add a comment in the code: "// TODO: FIND THIS - [Description of what needs to be found]".
      7. OUTPUT: Provide only the necessary new files or updated versions of existing files.
      
      ACT AS A PRO TUTOR: Below the code, provide a detailed "Tutor's Breakdown" explaining how you reused existing project components and handled new Odoo challenges.

      OUTPUT FORMAT:
      Return a JSON object:
      {
        "sharedPomClassesUsed": ["fileName1", "fileName2"], 
        "pomClasses": [
          { "fileName": "string", "content": "string" }
        ],
        "testScript": { "fileName": "string", "content": "string" },
        "explanation": "Markdown string for the Tutor's Breakdown"
      }
    `;

    try {
      const response = await aiRef.current.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: {
          role: "user",
          parts: [
            { text: prompt },
            ...mediaFiles.map(file => ({
              inlineData: {
                data: file.data,
                mimeType: file.mimeType
              }
            })),
            ...feedbackMediaFiles.map(file => ({
              inlineData: {
                data: file.data,
                mimeType: file.mimeType
              }
            }))
          ]
        },
        config: {
          responseMimeType: "application/json",
        }
      });

      const result = JSON.parse(response.text || "{}");
      
      // Merge logic: Combine AI updates with existing project files
      const mergedPomClasses = [
        ...(generatedScript?.pomClasses || []),
        ...(result.pomClasses || [])
      ].reduce((acc, current) => {
        const existingIdx = acc.findIndex(p => p.fileName === current.fileName);
        if (existingIdx === -1) {
          return [...acc, current];
        } else {
          const updated = [...acc];
          updated[existingIdx] = current;
          return updated;
        }
      }, [] as { fileName: string; content: string }[]);

      const mergedTestScript = result.testScript || generatedScript?.testScript || { fileName: "test.spec.ts", content: "" };

      // Highlight changed files logic
      const changed = new Set<string>();
      
      // Check merged files against previous state for highlighting
      if (generatedScript) {
        if (result.testScript && result.testScript.content !== generatedScript.testScript?.content) {
          changed.add(result.testScript.fileName);
        }
        
        result.pomClasses?.forEach((newPom: { fileName: string; content: string }) => {
          const prevPom = generatedScript.pomClasses?.find(p => p.fileName === newPom.fileName);
          if (!prevPom || prevPom.content !== newPom.content) {
            changed.add(newPom.fileName);
          }
        });
      }
      
      setChangedFiles(changed);

      const newScript: ScriptResponse = {
        id: crypto.randomUUID(),
        title: testSteps.split('\n')[0].substring(0, 50) || "Generated Script",
        timestamp: new Date().toLocaleTimeString(),
        pomClasses: mergedPomClasses,
        testScript: mergedTestScript,
        explanation: result.explanation
      };

      setGeneratedScript(newScript);
      setActiveScriptId(newScript.id);
      setProjects(prev => prev.map(p => 
        p.id === activeProjectId 
          ? { ...p, scripts: [newScript, ...p.scripts] } 
          : p
      ));
      setFeedback("");
      setFeedbackMediaFiles([]);
      setTutorSolution(null);
    } catch (err) {
      console.error(err);
      setError("Failed to generate script. Please check your inputs and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteScript = (scriptId: string) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => 
      p.id === activeProjectId 
        ? { ...p, scripts: p.scripts.filter(s => s.id !== scriptId) } 
        : p
    ));
    if (activeScriptId === scriptId) {
      setGeneratedScript(null);
      setActiveScriptId(null);
      setChangedFiles(new Set());
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const configState = activeProject?.config || { url: "", db: "", username: "", password: "" };

  return (
    <div className="min-h-screen bg-bg text-text-main flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 bg-card border-b border-border px-6 flex items-center justify-between shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mr-2">
            <div className="text-accent font-black text-xl tracking-tighter flex items-center gap-1.5">
              <div className="w-6 h-6 bg-accent rounded-sm flex items-center justify-center">
                <Terminal size={14} className="text-white" />
              </div>
              QA.GEN
            </div>
          </div>
          
          {/* Project & Script Selectors Group */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#fafafa] border border-border rounded-input h-9 px-2 gap-2">
              <span className="text-[9px] font-bold text-text-sub uppercase tracking-tighter">Project</span>
              <select 
                value={activeProjectId || ""} 
                onChange={(e) => {
                  const id = e.target.value;
                  setActiveProjectId(id);
                  const proj = projects.find(p => p.id === id);
                  if (proj && proj.scripts.length > 0) {
                    setActiveScriptId(proj.scripts[0].id);
                    setGeneratedScript(proj.scripts[0]);
                  } else {
                    setActiveScriptId(null);
                    setGeneratedScript(null);
                  }
                }}
                className="bg-transparent text-xs font-bold outline-none cursor-pointer min-w-[120px]"
              >
                <option value="" disabled>Select Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button 
                onClick={() => setIsAddingProject(true)}
                className="p-1 text-accent hover:bg-accent hover:text-white rounded-sm transition-all"
                title="Create New Project"
              >
                <Plus size={14} />
              </button>
            </div>

            {activeProject && activeProject.scripts.length > 0 && (
              <div className="flex items-center bg-[#fafafa] border border-border rounded-input h-9 px-2 gap-2">
                <span className="text-[9px] font-bold text-text-sub uppercase tracking-tighter">History</span>
                <select 
                  value={activeScriptId || ""} 
                  onChange={(e) => {
                    const script = activeProject.scripts.find(s => s.id === e.target.value);
                    if (script) {
                      setGeneratedScript(script);
                      setActiveScriptId(script.id);
                      setChangedFiles(new Set());
                    }
                  }}
                  className="bg-transparent text-xs font-bold outline-none cursor-pointer max-w-[180px]"
                >
                  {activeProject.scripts.map(s => (
                    <option key={s.id} value={s.id}>{s.title} ({s.timestamp})</option>
                  ))}
                </select>
                <button 
                  onClick={() => activeScriptId && deleteScript(activeScriptId)}
                  className="p-1 text-text-sub hover:text-red-500 transition-all border-l border-border pl-2"
                  title="Delete Selected Result"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-accent-soft text-accent rounded-full text-[10px] font-bold uppercase tracking-wider border border-accent/10">
            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            Gemini 3.1 Pro
          </div>
          <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xs">
            {activeProject?.name?.charAt(0) || "U"}
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-12 grid-rows-12 gap-5 h-[calc(100vh-64px)] max-w-[1600px] mx-auto w-full overflow-hidden">
        {/* Environment Config Card - Col 1-4, Row 1-4 */}
        <section className="col-span-12 lg:col-span-4 lg:row-span-4 bg-card rounded-card border border-border p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-sub flex items-center gap-2">
              <Settings size={14} className="text-accent" />
              Environment
            </h2>
            {activeProject && (
              <span className="text-[10px] font-bold text-accent bg-accent-soft px-2 py-0.5 rounded uppercase border border-accent/10">
                {activeProject.name}
              </span>
            )}
          </div>
          <div className="space-y-4 flex-1">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-text-sub uppercase tracking-wider ml-1">Odoo URL</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sub/50" size={13} />
                <input 
                  type="text" 
                  placeholder="https://odoo-demo.com"
                  value={configState.url}
                  onChange={(e) => setConfig({ ...configState, url: e.target.value })}
                  className="w-full bg-[#fafafa] border border-border rounded-input py-2 pl-9 pr-3 text-xs font-medium focus:ring-1 focus:ring-accent outline-none transition-all placeholder:opacity-30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-text-sub uppercase tracking-wider ml-1">Database</label>
                <div className="relative">
                  <Database className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sub/50" size={13} />
                  <input 
                    type="text" 
                    placeholder="prod_db"
                    value={configState.db}
                    onChange={(e) => setConfig({ ...configState, db: e.target.value })}
                    className="w-full bg-[#fafafa] border border-border rounded-input py-2 pl-9 pr-3 text-xs font-medium focus:ring-1 focus:ring-accent outline-none transition-all placeholder:opacity-30"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-text-sub uppercase tracking-wider ml-1">Login</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sub/50" size={13} />
                  <input 
                    type="text" 
                    placeholder="admin"
                    value={configState.username}
                    onChange={(e) => setConfig({ ...configState, username: e.target.value })}
                    className="w-full bg-[#fafafa] border border-border rounded-input py-2 pl-9 pr-3 text-xs font-medium focus:ring-1 focus:ring-accent outline-none transition-all placeholder:opacity-30"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-text-sub uppercase tracking-wider ml-1">Password</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={configState.password || ""}
                onChange={(e) => setConfig({ ...configState, password: e.target.value })}
                className="w-full bg-[#fafafa] border border-border rounded-input py-2 px-3 text-xs font-medium focus:ring-1 focus:ring-accent outline-none transition-all placeholder:opacity-30"
              />
            </div>
          </div>
        </section>

        {/* Test Case / Scenario Card - Col 1-4, Row 5-12 */}
        <section className="col-span-12 lg:col-span-4 lg:row-span-8 bg-card rounded-card border border-border p-5 flex flex-col shadow-sm">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-sub mb-4 flex items-center gap-2">
            <Terminal size={14} className="text-accent" />
            Specs & Requirements
          </h2>
          <div className="space-y-5 flex flex-col flex-1">
            <div className="flex-1 flex flex-col space-y-1.5">
              <label className="text-[9px] font-bold text-text-sub uppercase tracking-wider ml-1">Test Steps</label>
              <textarea 
                placeholder="1. Login to Odoo..."
                value={testSteps}
                onChange={(e) => setTestSteps(e.target.value)}
                className="w-full flex-1 bg-[#fafafa] border border-border rounded-input py-3 px-4 text-xs font-medium focus:ring-1 focus:ring-accent outline-none resize-none font-mono leading-relaxed"
              />
            </div>
            <div className="h-40 flex flex-col space-y-1.5">
              <label className="text-[9px] font-bold text-text-sub uppercase tracking-wider ml-1">Client Business Logic</label>
              <textarea 
                placeholder="Define specific client rules..."
                value={functionalRequirements}
                onChange={(e) => setFunctionalRequirements(e.target.value)}
                className="w-full flex-1 bg-[#fafafa] border border-border rounded-input py-3 px-4 text-xs font-medium focus:ring-1 focus:ring-accent outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Visual Evidence Section */}
            <div className="mt-2 pt-4 border-t border-border">
              <label className="text-[10px] font-bold text-text-sub uppercase mb-2 flex items-center justify-between">
                <span>Visual Evidence (Images/Video)</span>
                <span className="text-[9px] lowercase font-normal opacity-60">Max 5 files</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {mediaFiles.map((file, i) => (
                  <div key={i} className="group relative w-12 h-12 bg-bg border border-border rounded-input flex items-center justify-center overflow-hidden">
                    {file.mimeType.startsWith('image/') ? (
                      <FileImage size={18} className="text-accent" />
                    ) : (
                      <FileVideo size={18} className="text-accent" />
                    )}
                    <button 
                      onClick={() => removeMediaFile(file.name)}
                      className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {mediaFiles.length < 5 && (
                  <label className="w-12 h-12 border border-border border-dashed rounded-input flex items-center justify-center cursor-pointer hover:bg-bg transition-all">
                    <input 
                      type="file" 
                      accept="image/*,video/*" 
                      multiple 
                      className="hidden" 
                      onChange={handleFileUpload}
                    />
                    <Upload size={16} className="text-text-sub" />
                  </label>
                )}
              </div>
              <p className="text-[9px] text-text-sub leading-tight italic">
                Upload screenshots or a screen recording to help Gemini visualize Odoo's dynamic UI.
              </p>
            </div>
          </div>
        </section>

        {/* Code Output Card - Col 5-12, Row 1-9 */}
        <section className="col-span-12 lg:col-span-8 lg:row-span-9 bg-card rounded-card border border-border p-6 flex flex-col shadow-sm overflow-hidden relative group/result">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-sub flex items-center gap-2">
              <FileCode size={16} className="text-accent" />
              Automation Workbench
            </h2>
            {generatedScript && (
              <div className="flex items-center gap-2">
                 <span className="bg-accent-soft text-accent px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-accent/10">Active Script</span>
                 <span className="text-[10px] text-text-sub/50 font-mono">#{generatedScript.id.substring(0, 8)}</span>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#fafafa] rounded-input border border-border border-dashed">
                <div className="w-12 h-12 border-2 border-border border-t-accent rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium text-text-sub animate-pulse">Gemini is architecting your scripts...</p>
              </div>
            ) : generatedScript ? (
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
                  <div className="flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-text-sub uppercase tracking-wide">Test File</span>
                        {generatedScript?.testScript?.fileName && changedFiles.has(generatedScript.testScript.fileName) && (
                          <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px] font-bold animate-pulse uppercase border border-amber-200">Modified</span>
                        )}
                      </div>
                      <button 
                        onClick={() => copyToClipboard(generatedScript.testScript.content)}
                        className="text-text-sub hover:text-accent p-1 transition-colors"
                        title="Copy Test script"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    <div className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded-input font-mono text-[11px] flex-1 overflow-auto leading-relaxed border border-[#333]">
                      <code>{generatedScript.testScript.content}</code>
                    </div>
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[10px] font-bold text-text-sub mb-2 uppercase tracking-wide">POM Classes</span>
                    <div className="space-y-2 overflow-auto flex-1 pr-1">
                      {generatedScript.pomClasses.map((cl, i) => (
                        <div key={i} className={`bg-[#fafafa] border p-3 rounded-input relative group transition-all ${changedFiles.has(cl.fileName) ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)] ring-1 ring-amber-400/20' : 'border-border'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-accent font-mono">{cl.fileName}</span>
                              {changedFiles.has(cl.fileName) && (
                                <span className="text-[8px] font-bold text-amber-600 uppercase tracking-tighter">Modified</span>
                              )}
                            </div>
                            <button onClick={() => copyToClipboard(cl.content)} className="text-text-sub hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                              <Copy size={12} />
                            </button>
                          </div>
                          <div className="text-[10px] font-mono text-text-sub line-clamp-4 leading-tight opacity-70">
                            {cl.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => copyToClipboard(generatedScript.testScript.content)} className="flex-1 bg-accent text-white py-2.5 rounded-input text-sm font-bold shadow-md shadow-accent/20 hover:opacity-90 transition-all flex items-center justify-center gap-2">
                    <Copy size={16} /> Copy Test Script
                  </button>
                  <button 
                    onClick={() => setShowGuide(true)}
                    className="flex-1 border border-accent text-accent py-2.5 rounded-input text-sm font-bold hover:bg-accent-soft transition-all flex items-center justify-center gap-2"
                  >
                    <Terminal size={16} /> Run Guide
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#fafafa] rounded-input border border-border border-dashed text-center p-8">
                <FileCode className="text-text-sub/20 mb-4" size={48} />
                <h4 className="text-sm font-bold text-text-sub">No Script Yet</h4>
                <p className="text-xs text-text-sub/60 mt-1">Configure environment and steps to start generation</p>
              </div>
            )}
          </div>
        </section>

        {/* Feedback Card - Col 5-8, Row 10-12 */}
        <section className="col-span-12 lg:col-span-4 lg:row-span-3 bg-card rounded-card border-2 border-accent/5 p-5 flex flex-col shadow-lg shadow-accent/5 relative group/feedback overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-sub flex items-center gap-2">
              <UserIcon size={14} className="text-accent" />
              Smart Tutor
              {feedbackAttempts > 0 && (
                <span className="ml-2 text-[8px] px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full font-black uppercase">
                  Attempt {feedbackAttempts + 1}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <button 
                title="Upload Screenshot" 
                className="p-1 hover:bg-bg rounded cursor-pointer text-text-sub hover:text-accent transition-colors relative"
              >
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={handleFeedbackFileUpload}
                />
                <Upload size={14} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col min-h-0">
            <textarea 
              placeholder="Describe issues or paste error screenshots here..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onPaste={handleFeedbackPaste}
              className="w-full flex-1 bg-[#fafafa] border border-border rounded-input py-2 px-3 text-xs focus:ring-1 focus:ring-accent outline-none resize-none"
            />
            
            {(feedbackMediaFiles.length > 0 || tutorSolution) && (
              <div className="mt-2 space-y-2 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">
                {feedbackMediaFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {feedbackMediaFiles.map((f, i) => (
                      <div key={i} className="relative group/thumb w-8 h-8 rounded border border-border overflow-hidden shrink-0 bg-bg flex items-center justify-center">
                        <FileImage size={10} className="text-accent" />
                        <button 
                          onClick={() => removeFeedbackMediaFile(f.name)}
                          className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {tutorSolution && (
                   <div className={`p-2 rounded border text-[10px] leading-relaxed relative group/solution ${feedbackAttempts >= 2 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-accent-soft border-accent/10 text-accent'}`}>
                     <div className="font-bold mb-1 flex items-center gap-1">
                       {feedbackAttempts >= 2 ? <ShieldAlert size={10} /> : <CheckCircle2 size={10} />}
                       {feedbackAttempts >= 2 ? "Diagnostic Guidance" : "Proposed Solution"}
                     </div>
                     <div className="whitespace-pre-wrap">{tutorSolution.substring(0, 300)}...</div>
                     <button 
                       onClick={() => copyToClipboard(tutorSolution)}
                       className="absolute top-1 right-1 p-1 opacity-0 group-hover/solution:opacity-100 transition-opacity"
                     >
                       <Copy size={10} />
                     </button>
                   </div>
                )}
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button 
              onClick={solveProblem}
              disabled={(!feedback && feedbackMediaFiles.length === 0) || isSolving || isGenerating}
              className="border border-accent text-accent py-2 rounded-input text-[10px] font-bold hover:bg-accent-soft disabled:opacity-50 transition-all flex flex-col items-center justify-center leading-tight h-10"
              title="Get a quick fix or explanation for a specific issue"
            >
              {isSolving ? <RefreshCw size={10} className="animate-spin mb-1" /> : <BrainCircuit size={10} className="mb-1" />}
              {isSolving ? "Analyzing..." : "Solve Specific Problem"}
            </button>
            <button 
              onClick={() => generateScript(activeTab)}
              disabled={(!feedback && feedbackMediaFiles.length === 0) || isGenerating || isSolving}
              className="bg-accent text-white py-2 rounded-input text-[10px] font-bold shadow-md shadow-accent/20 hover:opacity-90 disabled:opacity-50 transition-all flex flex-col items-center justify-center leading-tight h-10"
              title="Rewrite the entire test suite incorporating the feedback"
            >
              {isGenerating ? <RefreshCw size={10} className="animate-spin mb-1" /> : <RefreshCw size={10} className="mb-1" />}
              {isGenerating ? "Rewriting..." : "Update Whole Code"}
            </button>
          </div>
          
          <p className="absolute -top-1 left-20 bg-card px-2 text-[8px] text-text-sub opacity-0 group-hover/feedback:opacity-100 transition-opacity">
            Apply Adjustments will rewrite all your project files
          </p>
        </section>

        {/* Controls Card - Col 9-12, Row 10-12 */}
        <section className="col-span-12 lg:col-span-4 lg:row-span-3 bg-card rounded-card border border-border p-6 flex flex-col shadow-sm justify-between bg-gradient-to-br from-white to-[#fafafa]">
          <div className="flex items-center justify-between pointer-events-none">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-sub">Automation Control</span>
             <div className="flex items-center gap-2 pointer-events-auto">
               <span className="text-[9px] font-bold text-text-sub uppercase tracking-tighter">Robust Edge Cases</span>
               <input 
                 type="checkbox" 
                 checked={activeTab === "negative"} 
                 onChange={(e) => setActiveTab(e.target.checked ? "negative" : "positive")}
                 className="w-4 h-4 rounded appearance-none bg-bg border border-border checked:bg-accent checked:border-accent transition-all cursor-pointer relative after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-2 after:h-2 after:bg-white after:rounded-sm after:opacity-0 checked:after:opacity-100"
               />
             </div>
          </div>
          
          <div className="space-y-3 mt-4">
            <button 
              onClick={() => generateScript("positive")}
              disabled={isGenerating || !testSteps}
              className="w-full bg-accent text-white py-4 rounded-input font-black text-xs uppercase tracking-widest shadow-xl shadow-accent/20 hover:translate-y-[-1px] active:translate-y-[1px] disabled:opacity-50 disabled:translate-y-0 transition-all flex items-center justify-center gap-2"
            >
              <Play size={16} fill="currentColor" />
              Generate Test Suite
            </button>
            <div className="flex items-center gap-2 justify-center py-1">
              <div className="w-1 h-1 bg-accent rounded-full animate-ping" />
              <p className="text-[9px] text-text-sub font-bold uppercase tracking-wider opacity-60">
                AI Agent Ready for Odoo v17/18
              </p>
            </div>
          </div>
        </section>
      </main>

      {error && (
        <div className="fixed bottom-6 right-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-card flex items-center gap-3 shadow-xl z-[100] animate-in slide-in-from-right">
          <ShieldAlert size={18} />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      )}

      {/* New Project Modal */}
      <AnimatePresence>
        {isAddingProject && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-card shadow-2xl border border-border p-6 w-full max-w-sm"
            >
              <h3 className="text-sm font-bold text-text-main mb-4">Create New Project</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-sub uppercase">Project Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Sales Flow Automation"
                    autoFocus
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createProject()}
                    className="w-full bg-[#fafafa] border border-border rounded-input py-2 px-3 text-xs focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setIsAddingProject(false)}
                    className="flex-1 py-2 rounded-input text-xs font-bold text-text-sub hover:bg-bg transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={createProject}
                    disabled={!newProjectName.trim()}
                    className="flex-1 py-2 rounded-input text-xs font-bold bg-accent text-white disabled:opacity-50 transition-all shadow-md shadow-accent/20"
                  >
                    Create Project
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Execution Guide Modal */}
      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-card shadow-2xl border border-border p-8 w-full max-w-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <Terminal size={20} className="text-accent" />
                  Playwright Execution Guide
                </h3>
                <button onClick={() => setShowGuide(false)} className="text-text-sub hover:text-accent">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              
              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-accent uppercase tracking-widest">Recommended Project Structure</h4>
                  <div className="bg-[#1e1e1e] p-4 rounded-input font-mono text-[11px] text-[#d4d4d4]">
                    <p className="text-accent mb-2">/my-playwright-project</p>
                    <div className="pl-4 space-y-1">
                      <p>├── <span className="text-white">package.json</span></p>
                      <p>├── <span className="text-white">playwright.config.ts</span></p>
                      <p>├── <span className="text-white">tests/</span> <span className="opacity-40"># Spec files</span></p>
                      <p className="pl-4">└── {generatedScript?.testScript?.fileName || 'create-order.spec.ts'}</p>
                      <p>└── <span className="text-white">pages/</span> <span className="opacity-40"># POM classes</span></p>
                      {generatedScript?.pomClasses?.map((cl, i) => (
                        <p key={i} className="pl-4">└── {cl.fileName}</p>
                      )) || <p className="pl-4">└── login.page.ts</p>}
                    </div>
                  </div>
                  <p className="text-[10px] text-text-sub leading-relaxed italic">
                    The generated scripts use relative imports (e.g., <code className="text-accent font-bold">../pages/login.page</code>). Placing files in these exact folders ensures everything works without modification.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-accent uppercase tracking-widest">Option 1: Terminal Execution</h4>
                  <div className="bg-[#1e1e1e] p-4 rounded-input font-mono text-[11px] text-[#d4d4d4] space-y-2">
                    <p className="opacity-50"># Run the specific test file</p>
                    <p>npx playwright test {generatedScript?.testScript?.fileName || 'your_test.spec.ts'}</p>
                    <p className="opacity-50 mt-2"># Run in headed mode to see the browser</p>
                    <p>npx playwright test --headed</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-accent uppercase tracking-widest">Option 2: Playwright UI Mode</h4>
                  <div className="space-y-2 text-sm text-text-sub">
                    <p>1. Open the UI runner by running this command in your terminal:</p>
                    <div className="bg-[#1e1e1e] p-3 rounded-input font-mono text-[11px] text-[#d4d4d4]">
                      npx playwright test --ui
                    </div>
                    <p>2. Locate your test script <span className="font-bold text-accent">({generatedScript?.testScript?.fileName || 'your_test.spec.ts'})</span> in the list.</p>
                    <p>3. Click the <span className="p-1 bg-bg border border-border rounded text-[10px]">Play</span> icon to run while watching the live trace.</p>
                  </div>
                </div>

                <div className="p-4 bg-accent-soft border border-accent/20 rounded-card">
                  <p className="text-xs font-medium text-accent leading-relaxed">
                    <strong>Note:</strong> Ensure you have copied all POM classes into your project directory before running. The AI has optimized these classes for the latest Odoo version.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => setShowGuide(false)}
                  className="bg-accent text-white px-6 py-2.5 rounded-input text-xs font-bold shadow-lg shadow-accent/20 hover:opacity-90 transition-all"
                >
                  Got it, close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!activeProjectId && !isAddingProject && projects.length === 0 && (
         <div className="fixed inset-0 bg-bg z-[150] flex flex-col items-center justify-center p-6 text-center">
            <BrainCircuit size={64} className="text-accent mb-6" />
            <h1 className="text-2xl font-extrabold text-text-main tracking-tight mb-2">Welcome to Odoo.QA</h1>
            <p className="text-text-sub max-w-md mb-8">
              Start by creating your first automation project. Each project manages its own environment and reusable POM classes.
            </p>
            <button 
              onClick={() => setIsAddingProject(true)}
              className="bg-accent text-white px-8 py-4 rounded-input font-bold shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus size={20} /> Create Your First Project
            </button>
         </div>
      )}
    </div>
  );
}
