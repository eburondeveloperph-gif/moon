/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import ErrorScreen from './components/demo/ErrorScreen';
import AuthScreen from './components/demo/AuthScreen';
import StreamingConsole from './components/demo/streaming-console/StreamingConsole';

import Sidebar from './components/Sidebar';
import { LiveAPIProvider } from './contexts/LiveAPIContext';

const API_KEY = process.env.GEMINI_API_KEY;

function MissingApiKeyScreen() {
  return (
    <div className="auth-page">
      <div className="ambient-glow glow-1" />
      <div className="ambient-glow glow-2" />

      <main className="auth-main-stage">
        <div className="auth-brand-indicator">
          <div className="auth-brand-title">
            <div className="auth-status-dot" />
            Beatrice Playground
          </div>
          <div className="auth-brand-subtitle">Local environment setup required</div>
        </div>

        <div className="auth-modal">
          <div className="auth-modal-header">
            <h1>Missing Gemini API key</h1>
            <p>
              The frontend was rendering blank because the app crashed before mount.
              Add your Gemini key, then restart the dev server.
            </p>
          </div>

          <div className="auth-methods">
            <div className="auth-btn-secondary" style={{ justifyContent: 'flex-start', cursor: 'default' }}>
              <code>GEMINI_API_KEY=your_key_here</code>
            </div>
            <div className="auth-modal-footer" style={{ width: '100%', textAlign: 'left' }}>
              Create <code>.env.local</code> in the project root, add the key above, then run <code>npm run dev</code>.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Main application component that provides a streaming interface for Live API.
 * Manages video streaming state and provides controls for webcam/screen capture.
 */
function App() {
  if (!API_KEY) {
    return <MissingApiKeyScreen />;
  }

  return (
    <div className="App">
      <AuthScreen>
        <LiveAPIProvider apiKey={API_KEY}>
          <ErrorScreen />
          <main className="main-dashboard">
            <StreamingConsole />
          </main>
          <Sidebar />
        </LiveAPIProvider>
      </AuthScreen>
    </div>
  );
}

export default App;
