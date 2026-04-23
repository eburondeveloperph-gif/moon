/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { FunctionCall, useSettings, useUI, useTools, Template } from '@/lib/state';
import c from 'classnames';
import { DEFAULT_LIVE_API_MODEL, AVAILABLE_VOICES } from '@/lib/constants';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { useState } from 'react';
import ToolEditorModal from './ToolEditorModal';
import { examplePrompts } from '@/lib/prompts';
import ControlTray from './console/control-tray/ControlTray';

const AVAILABLE_MODELS = [
  DEFAULT_LIVE_API_MODEL
];

const TEMPLATES: { value: Template; label: string }[] = [
  { value: 'customer-support', label: 'Customer Support' },
  { value: 'personal-assistant', label: 'Personal Assistant' },
  { value: 'navigation-system', label: 'Navigation System' },
  { value: 'beatrice', label: 'Beatrice' },
];

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const { systemPrompt, model, voice, setSystemPrompt, setModel, setVoice } =
    useSettings();
  const { tools, toggleTool, addTool, removeTool, updateTool, template, setTemplate } = useTools();
  const { connected } = useLiveAPIContext();

  const [editingTool, setEditingTool] = useState<FunctionCall | null>(null);

  const handleSaveTool = (updatedTool: FunctionCall) => {
    if (editingTool) {
      updateTool(editingTool.name, updatedTool);
    }
    setEditingTool(null);
  };

  return (
    <>
      <aside className={c('sidebar glass', { open: isSidebarOpen })}>
        <div className="sidebar-header">
          <h2>Voice Hub</h2>
          <button onClick={toggleSidebar} className="close-button" title="Close sidebar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="sidebar-content">
          <div className="sidebar-section">
            <fieldset disabled={connected}>
              <div className="input-group">
                <label>Persona Template</label>
                <select
                  value={template}
                  onChange={e => setTemplate(e.target.value as Template)}
                  title="Persona Template"
                >
                  {TEMPLATES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Active Instruction Overlay</label>
                <textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  rows={6}
                  placeholder="The agent's current mission..."
                  title="System Prompt"
                />
              </div>

              <div className="example-prompts">
                <p className="example-prompts-title">Presets</p>
                <div className="example-prompts-list">
                  {examplePrompts[template].map((example, i) => (
                    <button
                      key={i}
                      className="example-prompt-chip"
                      onClick={() => setSystemPrompt(example.prompt)}
                      title={example.title}
                    >
                      {example.title}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="input-group">
                <label>Voice Persona</label>
                <select 
                  value={voice} 
                  onChange={e => setVoice(e.target.value)}
                  title="Voice Selection"
                >
                  {AVAILABLE_VOICES.map(v => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
          </div>
          
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Integrated Services</h4>
            <div className="tools-list">
              {tools.map(tool => (
                <div key={tool.name} className="tool-item">
                  <label className="tool-checkbox-wrapper">
                    <input
                      type="checkbox"
                      id={`tool-checkbox-${tool.name}`}
                      checked={tool.isEnabled}
                      onChange={() => toggleTool(tool.name)}
                      disabled={connected}
                    />
                    <span className="checkbox-visual"></span>
                  </label>
                  <label
                    htmlFor={`tool-checkbox-${tool.name}`}
                    className="tool-name-text"
                  >
                    {tool.name.replace(/_/g, ' ')}
                  </label>
                  <div className="tool-actions">
                    <button onClick={() => setEditingTool(tool)} disabled={connected} title="Edit tool">
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button onClick={() => removeTool(tool.name)} disabled={connected} title="Remove tool">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addTool}
              className="add-tool-button"
              disabled={connected}
            >
              <span className="material-symbols-outlined">add</span> Define New Capability
            </button>
          </div>
        </div>
        <div className="sidebar-footer">
          <ControlTray />
        </div>
      </aside>
      {editingTool && (
        <ToolEditorModal
          tool={editingTool}
          onClose={() => setEditingTool(null)}
          onSave={handleSaveTool}
        />
      )}
    </>
  );
}
