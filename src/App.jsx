import React, { useState, useEffect, useRef } from 'react';
import { Mic, Volume2, Play, CheckCircle, BarChart, BrainCircuit, Activity, Timer, Award, AlertTriangle, Video, Power } from 'lucide-react';
import Webcam from 'react-webcam';

// PASTE YOUR OPENAI API KEY HERE
const OPENAI_API_KEY = "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";

const VisualizerStyles = () => (
  <style>
    {`
      @keyframes soundwave {
        0% { height: 4px; opacity: 0.5; }
        50% { height: 24px; opacity: 1; }
        100% { height: 4px; opacity: 0.5; }
      }
      .bar { width: 4px; background: #fbbf24; border-radius: 4px; animation: soundwave 1.2s ease-in-out infinite; }
      .bar:nth-child(1) { animation-delay: 0.0s; }
      .bar:nth-child(2) { animation-delay: 0.2s; }
      .bar:nth-child(3) { animation-delay: 0.4s; }
      .bar:nth-child(4) { animation-delay: 0.1s; }
      .bar:nth-child(5) { animation-delay: 0.3s; }
      .bar:nth-child(6) { animation-delay: 0.5s; }
    `}
  </style>
);

const INTERVIEW_QUESTIONS = [
  "To start off, could you please tell me a little bit about yourself?",
  "Describe a time when you faced a significant challenge. How did you overcome it?",
  "How do you prioritize your tasks when working under tight, competing deadlines?",
  "Can you give an example of a time you had to adapt to a major change at work or school?",
  "Where do you see your professional growth heading in the next few years?",
  "Thank you. The system is now analyzing your verbal and tonal responses."
];

const TOTAL_QUESTIONS = INTERVIEW_QUESTIONS.length - 1;

export default function VoiceInterviewApp() {
  const [appState, setAppState] = useState('setup'); 
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [activeTab, setActiveTab] = useState('assessment');
  const [timeLeft, setTimeLeft] = useState(60);
  const [allTranscripts, setAllTranscripts] = useState([]);
  const [evaluationResults, setEvaluationResults] = useState([]);
  
  const [introCountdown, setIntroCountdown] = useState(null);
  const [isListeningForInsights, setIsListeningForInsights] = useState(false);
  const [currentAiText, setCurrentAiText] = useState("");
  const [gestureFeedback, setGestureFeedback] = useState("");

  const recognitionRef = useRef(null);
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const lastGestureTime = useRef(0);

  const appStateRef = useRef(appState);
  const transcriptRef = useRef("");
  const currentQuestionIdxRef = useRef(0);
  const allTranscriptsRef = useRef([]);
  const isAiSpeakingRef = useRef(false);
  const isUserSpeakingRef = useRef(false);
  const evaluationResultsRef = useRef([]);

  useEffect(() => {
    appStateRef.current = appState;
    transcriptRef.current = transcript;
    currentQuestionIdxRef.current = currentQuestionIdx;
    allTranscriptsRef.current = allTranscripts;
    isAiSpeakingRef.current = isAiSpeaking;
    isUserSpeakingRef.current = isUserSpeaking;
    evaluationResultsRef.current = evaluationResults;
  }, [appState, transcript, currentQuestionIdx, allTranscripts, isAiSpeaking, isUserSpeaking, evaluationResults]);

  // --- NEW: UNIVERSAL KEYBOARD LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // If we are on the setup screen, ANY key press starts the interview
      if (appStateRef.current === 'setup') {
        if (e.code === 'Space') e.preventDefault(); // Prevents the screen from scrolling down
        startInterview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- 1. REAL TEXT-TO-SPEECH (TTS) ENGINE ---
  const speakText = (text, onEndCallback) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; 
      utterance.pitch = 1;
      utterance.onend = () => { if (onEndCallback) onEndCallback(); };
      utterance.onerror = () => { if (onEndCallback) onEndCallback(); };
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => { if (onEndCallback) onEndCallback(); }, text.length > 5 ? 4000 : 1000);
    }
  };

  // --- AUDIO COUNTDOWN (During Questions) ---
  useEffect(() => {
    if (isUserSpeaking && timeLeft <= 15 && timeLeft > 0) {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(timeLeft.toString());
        utterance.rate = 1.3; 
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [timeLeft, isUserSpeaking]);

  // --- 2. SPEECH RECOGNITION SETUP ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let currentText = '';
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        setTranscript(currentText);
      };
    }
    
    return () => { 
      if (recognitionRef.current) recognitionRef.current.stop(); 
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (isUserSpeaking && recognitionRef.current) {
      try { recognitionRef.current.start(); } catch (e) {}
    } else if (!isUserSpeaking && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
  }, [isUserSpeaking]);

  useEffect(() => {
    let timer;
    if (isUserSpeaking && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && isUserSpeaking) {
      nextQuestion();
    }
    return () => clearInterval(timer);
  }, [isUserSpeaking, timeLeft]);

  // --- INTERACTIVE YES/NO LISTENER FOR INSIGHTS ---
  useEffect(() => {
    if (isListeningForInsights && transcript) {
      const lower = transcript.toLowerCase();
      if (lower.match(/\b(yes|yeah|sure|please|ok|okay)\b/)) {
        setIsListeningForInsights(false);
        setIsUserSpeaking(false);
        setCurrentAiText("Reading detailed insights...");
        readDetailedInsightsSequentially();
      } 
      else if (lower.match(/\b(no|nope|nah|stop)\b/)) {
        setIsListeningForInsights(false);
        setIsUserSpeaking(false);
        setCurrentAiText("Okay. You can view your detailed insights on the screen anytime.");
        speakText("Okay. You can view your detailed insights on the screen anytime.");
      }
    }
  }, [transcript, isListeningForInsights]);

  const readDetailedInsightsSequentially = () => {
    const sentences = evaluationResultsRef.current.map((res, i) => `For Question ${i + 1}, you scored ${res.score}. ${res.feedback}`);
    sentences.push("That concludes your feedback. Thank you for using Aura.");
    
    let i = 0;
    const speakNext = () => {
      if (i < sentences.length) {
        speakText(sentences[i], () => {
          i++;
          speakNext();
        });
      }
    };
    speakNext();
  };

  // --- 3. HAND GESTURE TRACKING LOGIC ---
  useEffect(() => {
    if ((appState !== 'active' && appState !== 'intro') || !window.Hands) return;

    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults((results) => {
      if (!canvasRef.current || !webcamRef.current?.video) return;
      const videoWidth = webcamRef.current.video.videoWidth;
      const videoHeight = webcamRef.current.video.videoHeight;
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      ctx.save();
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {color: '#ffffff', lineWidth: 2});
        window.drawLandmarks(ctx, landmarks, {color: '#fbbf24', lineWidth: 1, radius: 4}); 

        if (appStateRef.current === 'active') {
          const now = Date.now();
          if (now - lastGestureTime.current > 2000) {
            const isIndexUp = landmarks[8].y < landmarks[6].y;
            const isMiddleUp = landmarks[12].y < landmarks[10].y;
            const isRingUp = landmarks[16].y < landmarks[14].y;
            const isPinkyUp = landmarks[20].y < landmarks[18].y;

            const isMiddleDown = landmarks[12].y > landmarks[10].y;
            const isRingDown = landmarks[16].y > landmarks[14].y;
            const isPinkyDown = landmarks[20].y > landmarks[18].y;
            
            if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
              if (!isAiSpeakingRef.current) { 
                if (isUserSpeakingRef.current) {
                  setGestureFeedback("Pause Detected: Mic Off");
                  setIsUserSpeaking(false);
                  speakText("Recording paused.");
                } else {
                  setGestureFeedback("Resume Detected: Mic On");
                  speakText("Recording resumed.", () => { setIsUserSpeaking(true); });
                }
                lastGestureTime.current = now;
                setTimeout(() => setGestureFeedback(""), 2000);
              }
            }
            else if (isIndexUp && isMiddleUp && isRingDown && isPinkyDown) {
               setGestureFeedback("Peace Sign: Skipping");
               nextQuestion(); 
               lastGestureTime.current = now;
               setTimeout(() => setGestureFeedback(""), 2000);
            }
            else if (isIndexUp && isMiddleDown && isRingDown && isPinkyDown) {
               if (!isAiSpeakingRef.current) {
                  setGestureFeedback("1 Finger: Repeating Question");
                  repeatCurrentQuestion();
                  lastGestureTime.current = now;
                  setTimeout(() => setGestureFeedback(""), 2000);
               }
            }
          }
        }
      }
      ctx.restore();
    });

    if (webcamRef.current && webcamRef.current.video) {
      cameraRef.current = new window.Camera(webcamRef.current.video, {
        onFrame: async () => { await hands.send({image: webcamRef.current?.video}); },
        width: 320, height: 240
      });
      cameraRef.current.start();
    }

    return () => {
       if (cameraRef.current) cameraRef.current.stop();
       hands.close();
    };
  }, [appState]);

  // --- 4. INTERVIEW FLOW, INTRO RULES & SEQUENTIAL VERBAL COUNTDOWN ---
  const startInterview = () => {
    setAppState('intro'); 
    setIntroCountdown(null);
    setAllTranscripts([]);
    setEvaluationResults([]);
    setCurrentQuestionIdx(0);
    setIsListeningForInsights(false);

    const rulesText = "Welcome to Aura. Please prepare for your interview. Here are the gesture controls. Show an open palm to pause or resume recording. Show a peace sign to skip to the next question. Show one finger to repeat the current question. The interview will begin in...";

    speakText(rulesText, () => {
      runIntroCountdown(10);
    });
  };

  const runIntroCountdown = (count) => {
    setIntroCountdown(count);
    if (count > 0) {
      speakText(count.toString(), () => {
        setTimeout(() => runIntroCountdown(count - 1), 300);
      });
    } else {
      setAppState('active');
      triggerAiSpeech(0);
    }
  };

  const triggerAiSpeech = (questionIndex) => {
    setIsAiSpeaking(true);
    setIsUserSpeaking(false);
    setTranscript(""); 
    setTimeLeft(60);
    
    let textToSpeak = "";

    if (questionIndex === 0) {
      textToSpeak = `There are a total of ${TOTAL_QUESTIONS} questions. ${INTERVIEW_QUESTIONS[0]}`;
    } 
    else if (questionIndex < TOTAL_QUESTIONS) {
      const remainingQuestions = TOTAL_QUESTIONS - questionIndex;
      const questionWord = remainingQuestions === 1 ? 'question' : 'questions';
      textToSpeak = `You have ${remainingQuestions} ${questionWord} left. ${INTERVIEW_QUESTIONS[questionIndex]}`;
    } 
    else {
      textToSpeak = INTERVIEW_QUESTIONS[questionIndex];
    }

    setCurrentAiText(textToSpeak);

    speakText(textToSpeak, () => {
      setIsAiSpeaking(false);
      if (questionIndex < TOTAL_QUESTIONS) {
        setIsUserSpeaking(true);
      }
    });
  };

  const repeatCurrentQuestion = () => {
    setIsUserSpeaking(false); 
    if ('speechSynthesis' in window) window.speechSynthesis.cancel(); 
    
    const qText = INTERVIEW_QUESTIONS[currentQuestionIdxRef.current];
    setCurrentAiText(`Repeating: ${qText}`);
    setIsAiSpeaking(true);

    speakText(`Repeating question: ${qText}`, () => {
      setIsAiSpeaking(false);
      setIsUserSpeaking(true); 
    });
  };

  const nextQuestion = () => {
    setIsUserSpeaking(false);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel(); 
    
    const finalAnswer = transcriptRef.current.trim() || "(Candidate remained silent)";
    const currentIndex = currentQuestionIdxRef.current;
    
    const updatedTranscripts = [...allTranscriptsRef.current, {
      question: INTERVIEW_QUESTIONS[currentIndex],
      answer: finalAnswer
    }];
    setAllTranscripts(updatedTranscripts);

    const nextIdx = currentIndex + 1;
    setCurrentQuestionIdx(nextIdx);

    if (nextIdx >= INTERVIEW_QUESTIONS.length - 1) {
      triggerAiSpeech(nextIdx); 
      setTimeout(() => {
        setAppState('analyzing');
        runStrictOpenAIEvaluation(updatedTranscripts); 
      }, 4000); 
    } else {
      triggerAiSpeech(nextIdx);
    }
  };

  // --- 5. GRADING ENGINE & FINAL OUTRO ---
  const runStrictOpenAIEvaluation = async (transcriptsToEvaluate) => {
    const results = [];

    for (let i = 0; i < transcriptsToEvaluate.length; i++) {
      const item = transcriptsToEvaluate[i];
      const answerText = item.answer;

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: `Evaluate this interview answer strictly and return ONLY JSON format {"score": number, "confidence": "High|Medium|Low", "feedback": "string"}. Question: "${item.question}". Answer: "${answerText}"` }],
            temperature: 0.2
          })
        });

        if (!response.ok) throw new Error(`API Error`);
        const data = await response.json();
        let rawContent = data.choices[0].message.content.trim();
        if (rawContent.startsWith("```json")) rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
        results.push(JSON.parse(rawContent));

      } catch (error) {
        let simScore = 15; 
        let simFeedback = "";
        let simConfidence = "Low";

        if (!answerText || answerText.trim().length < 8 || answerText.includes("remained silent")) {
          simScore = 0;
          simFeedback = "Answer too short or missing.";
        } else {
          const lower = answerText.toLowerCase();
          const words = lower.split(/\s+/).filter(Boolean).length;
          
          if (words > 15) simScore += 25;
          if (words > 35) simScore += 25;

          const keywords = ["team", "leadership", "project", "impact", "goal", "learned", "challenge", "solved", "success", "experience", "adapt"];
          keywords.forEach(k => { if (lower.includes(k)) simScore += 8; });

          const fillers = ["um", "uh", "like"];
          let fillerCount = 0;
          fillers.forEach(f => { 
            const m = lower.match(new RegExp(`\\b${f}\\b`,"g")); 
            if (m) { simScore -= (m.length * 3); fillerCount += m.length; }
          });

          simScore = Math.max(0, Math.min(100, simScore));

          simFeedback = simScore >= 60 ? "Strong response!" : "Try to include more professional keywords.";
          if (fillerCount > 2) simFeedback += " Work on reducing filler words like 'um' and 'uh'.";

          if (simScore >= 75) simConfidence = "High";
          else if (simScore >= 50) simConfidence = "Medium";
          else simConfidence = "Low";
        }
        results.push({ score: simScore, confidence: simConfidence, feedback: simFeedback });
      }
    }

    setEvaluationResults(results);
    
    const avg = results.length > 0 ? Math.round(results.reduce((acc, curr) => acc + curr.score, 0) / results.length) : 0;
    
    let aiSuggestion = "Great job overall. Keep up the good work.";
    if (avg < 50) aiSuggestion = "To improve, try to provide more detailed answers and use professional keywords like leadership or impact.";
    else if (avg < 80) aiSuggestion = "Good effort. To improve your score, work on structuring your answers clearly and reducing filler words.";

    const summarySpeech = `Evaluation complete. Your final average score is ${avg} out of 100. ${aiSuggestion} Would you like to hear the score and feedback for each individual question? Please say yes or no.`;
    
    setCurrentAiText(summarySpeech);
    setAppState('results');

    speakText(summarySpeech, () => {
      setIsListeningForInsights(true);
      setTranscript(""); 
      setIsUserSpeaking(true); 
    });
  };

  const averageScore = evaluationResults.length > 0 
    ? Math.round(evaluationResults.reduce((acc, curr) => acc + curr.score, 0) / evaluationResults.length) 
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0700] text-amber-50 font-sans selection:bg-amber-500/30 flex flex-col items-center p-6 relative overflow-hidden">
      <VisualizerStyles />
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-amber-600/20 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-yellow-600/20 rounded-full blur-[150px] pointer-events-none"></div>

      {(appState === 'active' || appState === 'intro') && (
        <div className="absolute top-6 right-6 w-64 h-48 bg-black rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.3)] z-50 flex items-center justify-center group">
          <Webcam ref={webcamRef} className="absolute inset-0 w-full h-full object-cover -scale-x-100" audio={false} />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover -scale-x-100 z-10" />
          <div className="absolute top-2 left-2 bg-black/80 px-2 py-1 rounded text-[10px] font-bold text-amber-400 z-20 flex items-center gap-1 backdrop-blur-sm border border-amber-500/30">
            <Video size={12} /> {appState === 'intro' ? 'Camera Warming Up...' : 'Gesture AI Active'}
          </div>
          {gestureFeedback && appState === 'active' && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-amber-600 px-3 py-1 rounded-full text-[10px] font-bold text-black z-20 whitespace-nowrap shadow-[0_0_15px_rgba(245,158,11,0.8)] animate-bounce">
              {gestureFeedback}
            </div>
          )}
        </div>
      )}

      <div className="w-full max-w-5xl z-10">
        <header className="flex flex-col gap-6 mb-8 w-3/4"> 
          <div className="flex items-center gap-3">
            <div className="p-2 border border-amber-500/50 rounded-lg bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <BrainCircuit className="text-amber-400" size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500">AURA</h1>
              <p className="text-xs text-amber-200/60 font-medium uppercase tracking-widest">Smart Voice & Gesture System</p>
            </div>
          </div>
        </header>

        <main className="bg-[#120d04]/80 backdrop-blur-xl rounded-2xl border border-amber-500/30 shadow-[0_8px_32px_rgba(245,158,11,0.15)] overflow-hidden min-h-[500px] flex flex-col justify-center relative">
          <div className="absolute inset-0 bg-[url('[https://www.transparenttextures.com/patterns/cubes.png](https://www.transparenttextures.com/patterns/cubes.png)')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>

          {activeTab === 'assessment' && (
            <div className="relative z-10 w-full h-full flex flex-col justify-center">
              
              {/* THE ACCESSIBLE SYSTEM BOOT SCREEN */}
              {appState === 'setup' && (
                <div 
                  onClick={startInterview} 
                  className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500 py-16 px-8 cursor-pointer w-full h-full min-h-[500px]"
                >
                  {/* Screen Reader Only text - Read immediately when a blind user loads the page */}
                  <span className="sr-only">Welcome to the Aura Smart Interview System. Please click anywhere on the screen or press any key to initialize the interview and hear the instructions.</span>
                  
                  <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
                    <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-ping opacity-75"></div>
                    <div className="absolute inset-2 bg-yellow-500/20 rounded-full animate-pulse"></div>
                    <div className="relative z-10 w-24 h-24 bg-gradient-to-b from-amber-500 to-yellow-700 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.6)] border border-amber-200/50">
                      <Power size={40} className="text-black drop-shadow-md" />
                    </div>
                  </div>
                  <h2 className="text-4xl font-black tracking-wider mb-6 text-amber-100">Initialize Aura</h2>
                  <p className="text-amber-200/80 text-xl max-w-lg leading-relaxed">
                    <strong>Click anywhere</strong> on the screen or press <strong>any key</strong> to wake up the system and begin.
                  </p>
                </div>
              )}

              {/* INTRO STATE (Reads Rules + Counts Down 10 to 1 out loud) */}
              {appState === 'intro' && (
                <div className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500 p-12">
                  
                  {introCountdown === null ? (
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border border-amber-400/50 rounded-full flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(245,158,11,0.3)]">
                        <Volume2 size={40} className="text-amber-400 animate-pulse" />
                      </div>
                      <h2 className="text-3xl font-bold mb-4 text-amber-50">System Initialization</h2>
                      <p className="text-amber-200/80 max-w-md leading-relaxed animate-pulse">
                        Calibrating AI and reading gesture rules... Please listen carefully.
                      </p>
                      
                      <div className="mt-8 text-left bg-amber-950/40 p-6 rounded-xl border border-amber-500/20">
                         <strong className="text-amber-400 block mb-3 uppercase tracking-wider text-sm">🖐️ Gesture Rules:</strong>
                         <ul className="text-amber-100/70 text-sm space-y-2">
                           <li>• Show an <strong>Open Palm</strong> to pause/resume.</li>
                           <li>• Show a <strong>Peace Sign ✌️</strong> to skip question.</li>
                           <li>• Show <strong>1 Finger (Index)</strong> to repeat question.</li>
                         </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center mt-4">
                       <p className="text-amber-300/70 uppercase tracking-widest font-bold text-lg mb-4">Starting in</p>
                       <span key={introCountdown} className="text-9xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.8)] animate-in zoom-in duration-300">
                         {introCountdown}
                       </span>
                    </div>
                  )}
                </div>
              )}

              {appState === 'active' && (
                <div className="flex flex-col animate-in fade-in duration-500 p-8">
                  <div className="flex justify-between items-center mb-8 pb-4 border-b border-amber-500/30">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${isAiSpeaking ? 'bg-yellow-400 shadow-[0_0_15px_#fbbf24] animate-pulse' : 'bg-amber-500/30'}`}></div>
                      <span className={`text-sm font-bold uppercase tracking-wider ${isAiSpeaking ? 'text-yellow-400' : 'text-amber-400/50'}`}>System Audio</span>
                    </div>
                    {isUserSpeaking && (
                      <div className={`flex items-center gap-2 px-5 py-2 rounded-full border font-mono font-bold text-lg ${timeLeft <= 15 ? 'bg-red-900/40 border-red-500/80 text-red-400 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-amber-950/40 border-amber-500/50 text-amber-300'}`}>
                        <Timer size={20} /> 00:{timeLeft.toString().padStart(2, '0')}
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold uppercase tracking-wider ${isUserSpeaking ? 'text-amber-400' : 'text-amber-400/50'}`}>User Microphone</span>
                      <div className={`w-3 h-3 rounded-full ${isUserSpeaking ? 'bg-amber-400 shadow-[0_0_15px_#fbbf24] animate-pulse' : 'bg-amber-500/30'}`}></div>
                    </div>
                  </div>

                  <div className={`p-6 rounded-2xl border transition-all duration-500 mb-6 ${isAiSpeaking ? 'bg-amber-900/30 border-yellow-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)]' : 'bg-black/40 border-amber-500/20'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <Volume2 size={20} className={isAiSpeaking ? 'text-yellow-400' : 'text-amber-500/50'} />
                      <span className="text-xs font-bold text-amber-300/50 uppercase tracking-widest">
                        {currentQuestionIdx < TOTAL_QUESTIONS ? `Question ${currentQuestionIdx + 1} of ${TOTAL_QUESTIONS}` : 'System Outro'}
                      </span>
                    </div>
                    <p className="text-2xl text-amber-50 font-medium leading-relaxed">{currentAiText}</p>
                  </div>

                  <div className={`p-6 rounded-2xl border transition-all duration-500 h-48 flex flex-col mb-8 ${isUserSpeaking ? 'bg-amber-950/40 border-amber-400/50 shadow-[0_0_30px_rgba(245,158,11,0.15)]' : 'bg-black/40 border-amber-500/10'}`}>
                     <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-3">
                        <Mic size={20} className={isUserSpeaking ? 'text-amber-400' : 'text-amber-500/50'} />
                        <span className="text-xs font-bold text-amber-300/50 uppercase tracking-widest">{isUserSpeaking ? 'Live Transcription Active' : 'Microphone Paused'}</span>
                       </div>
                       {isUserSpeaking && (
                         <div className="flex items-center gap-1 h-6">
                           <div className="bar"></div><div className="bar"></div><div className="bar"></div>
                           <div className="bar"></div><div className="bar"></div><div className="bar"></div>
                         </div>
                       )}
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2">
                      <p className="text-xl text-amber-100/90 font-light leading-relaxed">
                        {transcript || (isUserSpeaking ? "Start speaking now..." : "Audio paused. Waiting for system...")}
                      </p>
                    </div>
                  </div>

                  <button onClick={nextQuestion} disabled={isAiSpeaking || currentQuestionIdx >= TOTAL_QUESTIONS} className={`w-full py-4 rounded-xl font-bold text-lg tracking-wide transition-all ${isAiSpeaking || currentQuestionIdx >= TOTAL_QUESTIONS ? 'bg-amber-950/30 text-amber-500/30 cursor-not-allowed border border-amber-900/30' : 'bg-gradient-to-r from-amber-600 to-yellow-600 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-amber-300/50 hover:scale-[1.01]'}`}>
                    Submit Answer
                  </button>
                </div>
              )}

              {appState === 'analyzing' && (
                <div className="flex flex-col items-center justify-center py-10 animate-in fade-in duration-500 p-8">
                  <Activity size={64} className="text-amber-400 animate-pulse mb-6 drop-shadow-[0_0_30px_rgba(245,158,11,0.6)]" />
                  <h2 className="text-2xl font-bold mb-3 text-amber-100">Evaluation in Progress</h2>
                  <div className="w-64 h-2 bg-amber-950 rounded-full overflow-hidden mt-6 border border-amber-500/30">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 w-1/2 animate-[pulse_1s_ease-in-out_infinite]"></div>
                  </div>
                </div>
              )}

              {appState === 'results' && (
                <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500 p-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-amber-400/20 to-yellow-500/20 border border-amber-400/50 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(245,158,11,0.3)]">
                    <CheckCircle size={48} className="text-amber-400" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2 text-amber-50">Evaluation Complete</h2>
                  
                  <p className="text-amber-200/80 text-sm text-center max-w-lg mb-6 italic h-10">{currentAiText}</p>

                  <div className="w-full flex justify-center mb-6">
                    <div className="bg-amber-950/40 px-16 py-8 rounded-2xl border border-amber-500/40 flex flex-col items-center shadow-[0_0_30px_rgba(245,158,11,0.15)] text-center">
                      <span className={`text-6xl font-black mb-2 ${averageScore >= 80 ? 'text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]' : averageScore >= 60 ? 'text-yellow-500' : 'text-orange-500'}`}>
                        {averageScore}<span className="text-3xl text-amber-500/50">/100</span>
                      </span>
                      <span className="text-sm text-amber-200/70 uppercase font-bold tracking-wider mt-2">Final Average Score</span>
                    </div>
                  </div>

                  {isListeningForInsights && (
                     <div className="mb-6 flex items-center gap-3 bg-amber-900/40 border border-amber-500/50 px-6 py-3 rounded-full animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                       <Mic className="text-amber-400" size={20} />
                       <span className="text-amber-200 font-bold text-sm tracking-wider">Say "Yes" or "No"</span>
                     </div>
                  )}

                  <div className="flex gap-4 w-full max-w-md">
                    <button onClick={() => { setIsListeningForInsights(false); if('speechSynthesis' in window) window.speechSynthesis.cancel(); setActiveTab('insights'); }} className="flex-1 py-4 rounded-xl font-bold tracking-wide bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/50 transition-colors text-amber-300">
                      View Insights
                    </button>
                    <button onClick={() => { setAppState('setup'); setCurrentQuestionIdx(0); setTranscript(""); setAllTranscripts([]); setEvaluationResults([]); setActiveTab('assessment'); }} className="flex-1 py-4 rounded-xl font-bold tracking-wide bg-gradient-to-r from-amber-600 to-yellow-600 text-black hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-amber-300/50">
                      New Session
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'insights' && (
             <div className="w-full max-w-4xl mx-auto animate-in fade-in duration-300 h-full flex flex-col p-8">
               <div className="flex items-center justify-between mb-8 pb-4 border-b border-amber-500/30">
                 <div className="flex items-center gap-3">
                   <BarChart className="text-amber-400" size={24} />
                   <h2 className="text-xl font-bold text-amber-100">Performance Analytics</h2>
                 </div>
                 <button onClick={() => setActiveTab('assessment')} className="text-xs font-bold text-amber-400/70 hover:text-amber-400 uppercase tracking-widest">
                   Back to Assessment
                 </button>
               </div>
               
               {evaluationResults.length === 0 ? (
                 <div className="flex flex-col items-center justify-center flex-1 text-amber-500/40">
                    <Award size={48} className="mb-4 opacity-50" />
                    <p>Complete an assessment to unlock your golden analytics.</p>
                 </div>
               ) : (
                 <div className="space-y-4 overflow-y-auto pr-2 pb-4">
                   {evaluationResults.map((result, index) => (
                     <div key={index} className="bg-[#120d04]/90 border border-amber-500/30 rounded-xl p-6 flex flex-col gap-4 hover:border-amber-400/60 transition-colors shadow-lg">
                       <div className="flex justify-between items-start">
                         <div className="max-w-[75%]">
                           <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest block mb-2">Question {index + 1}</span>
                           <p className="text-amber-50 text-sm font-medium leading-relaxed">{INTERVIEW_QUESTIONS[index]}</p>
                           <div className="mt-3 p-3 bg-black/50 rounded-lg border border-amber-900/50">
                             <p className="text-amber-200/60 text-xs italic">"{allTranscripts[index]?.answer}"</p>
                           </div>
                         </div>
                         <div className="flex flex-col items-end">
                           <span className={`text-4xl font-black ${result.score >= 80 ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]' : result.score >= 60 ? 'text-yellow-500' : 'text-orange-500'}`}>
                             {result.score}
                           </span>
                           <span className="text-[10px] text-amber-500/70 uppercase font-bold tracking-wider mt-1">Total Score</span>
                         </div>
                       </div>
                       
                       <div className="bg-amber-950/20 rounded-lg p-4 border border-amber-500/20 flex flex-col gap-2 mt-2">
                         <div className="flex items-center justify-between">
                            <span className="text-xs text-amber-300 uppercase font-bold tracking-wider">Tone & Confidence Analysis:</span>
                            <span className={`text-xs font-bold px-3 py-1 rounded border ${result.confidence === 'High' ? 'bg-amber-500/20 border-amber-400/50 text-amber-300' : result.confidence === 'Medium' ? 'bg-yellow-900/30 border-yellow-500/50 text-yellow-400' : 'bg-orange-900/30 border-orange-500/50 text-orange-400'}`}>
                              {result.confidence}
                            </span>
                         </div>
                         <div className="flex gap-2 items-start mt-2">
                           <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                           <p className="text-sm text-amber-100/80 leading-relaxed">{result.feedback}</p>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          )}
        </main>
      </div>
    </div>
  );
}