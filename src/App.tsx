import { useRef, useEffect } from 'react';
import './index.css';

function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.focus();
    }
  }, []);

  return (
    <div className="game-container">
      <iframe 
        ref={iframeRef}
        src="/road-rash/game.html" 
        className="game-iframe"
        title="Ghost Riders Game"
        scrolling="no"
      />
    </div>
  );
}

export default App;
