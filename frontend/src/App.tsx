import { useState } from 'react'
import axios from 'axios'
import { Server, Settings, CheckCircle, Database } from 'lucide-react'

export interface TestCase {
  id: string
  title: string
  type: string
  priority: string
  preconditions: string
  steps: string[]
  test_data: string
  expected_result: string
  linked_jira_id: string
}

function App() {
  const [jiraUrl, setJiraUrl] = useState('')
  const [email, setEmail] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [authStatus, setAuthStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  const [jiraId, setJiraId] = useState('')
  const [template, setTemplate] = useState('default.yaml')
  const [provider, setProvider] = useState('ollama')
  const [groqApiKey, setGroqApiKey] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [testCases, setTestCases] = useState<TestCase[]>([])

  const testConnection = async () => {
    setAuthStatus('testing')
    try {
      await axios.post('http://localhost:8000/api/jira/test-connection', {
        jira_url: jiraUrl,
        email: email,
        api_token: apiToken
      })
      setAuthStatus('success')
    } catch {
      setAuthStatus('error')
    }
  }

  const generateTests = async () => {
    setIsGenerating(true)
    try {
      const resp = await axios.post('http://localhost:8000/api/testcases/generate', {
        jira_url: jiraUrl,
        email: email,
        api_token: apiToken,
        jira_id: jiraId,
        template_name: template,
        provider: provider,
        groq_api_key: groqApiKey.trim() || undefined
      })
      setTestCases(resp.data)
    } catch (e) {
      alert("Error generating test cases. Check backend errors.")
    }
    setIsGenerating(false)
  }

  const writeBack = async () => {
    try {
      await axios.post('http://localhost:8000/api/testcases/export', {
        jira_url: jiraUrl,
        email: email,
        api_token: apiToken,
        jira_id: jiraId,
        test_cases: testCases
      })
      alert("Successfully written back to Jira!")
    } catch {
      alert("Failed to write back to Jira.")
    }
  }

  const exportCSV = () => {
    if (testCases.length === 0) return;
    const header = ['ID', 'Title', 'Type', 'Priority', 'Preconditions', 'Steps', 'Test Data', 'Expected Result', 'Linked Jira ID'].join(',') + '\\n';
    const rows = testCases.map(tc => {
      return [
        tc.id,
        `"${tc.title.replace(/"/g, '""')}"`,
        tc.type,
        tc.priority,
        `"${tc.preconditions.replace(/"/g, '""')}"`,
        `"${tc.steps.join('; ').replace(/"/g, '""')}"`,
        `"${tc.test_data.replace(/"/g, '""')}"`,
        `"${tc.expected_result.replace(/"/g, '""')}"`,
        tc.linked_jira_id
      ].join(',')
    }).join('\\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TestCases_${jiraId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center space-x-3 mb-8 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <Database className="w-10 h-10 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              Jira Test Case Generator
            </h1>
            <p className="text-gray-500">Auto-generate and manage test cases powered by Groq or Local Ollama</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition hover:shadow-md">
              <h2 className="text-lg font-semibold flex items-center space-x-2 mb-4">
                <Settings className="w-5 h-5 text-gray-500" />
                <span>Jira Connection</span>
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
                  <input type="text" value={jiraUrl} onChange={e => setJiraUrl(e.target.value)} placeholder="https://domain.atlassian.net" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                  <input type="password" value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                <button onClick={testConnection} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 rounded-lg transition flex justify-center items-center space-x-2">
                  <span>Test Connection</span>
                  {authStatus === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition hover:shadow-md">
              <h2 className="text-lg font-semibold flex items-center space-x-2 mb-4">
                <Server className="w-5 h-5 text-gray-500" />
                <span>Test Generation</span>
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jira issue ID</label>
                  <input type="text" value={jiraId} onChange={e => setJiraId(e.target.value)} placeholder="PROJ-123" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                  <select value={template} onChange={e => setTemplate(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">
                    <option value="default.yaml">Default (Functional)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LLM Provider</label>
                  <select value={provider} onChange={e => setProvider(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">
                    <option value="ollama">Local (Ollama)</option>
                    <option value="groq">Cloud (Groq)</option>
                  </select>
                </div>
                {provider === 'groq' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Groq API Key</label>
                    <input type="password" value={groqApiKey} onChange={e => setGroqApiKey(e.target.value)} placeholder="gsk_..." className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" />
                  </div>
                )}
                <button onClick={generateTests} disabled={isGenerating || authStatus !== 'success'} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 rounded-lg transition shadow-md mt-2">
                  {isGenerating ? 'Generating Context...' : 'Generate Cases'}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[500px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Generated Test Cases</h2>
                {testCases.length > 0 && (
                  <div className="flex space-x-2">
                    <button onClick={exportCSV} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium transition shadow-sm border">
                      Export CSV
                    </button>
                    <button onClick={writeBack} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm">
                      Write Back to Jira
                    </button>
                  </div>
                )}
              </div>
              
              {testCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <Database className="w-12 h-12 mb-3 opacity-20" />
                  <p>Provide Jira connection info and issue ID to generate.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {testCases.map((tc, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-5 bg-[#fafafa] shadow-sm hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-lg text-gray-800">{tc.title} <span className="text-sm font-normal text-gray-500">[{tc.id}]</span></h3>
                        <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-indigo-200">
                          {tc.type} | {tc.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4"><span className="font-semibold text-gray-700">Preconditions:</span> {tc.preconditions}</p>
                      
                      <div className="mb-4 bg-white p-4 rounded border">
                        <span className="font-semibold text-sm text-gray-700">Steps:</span>
                        <ul className="mt-2 space-y-1 text-sm text-gray-600">
                          {tc.steps.map((s, idx) => (
                            <li key={idx} className="flex">
                              <span className="text-gray-400 mr-2">{idx + 1}.</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-blue-50 bg-opacity-50 border border-blue-100 p-3 rounded">
                          <span className="font-semibold text-blue-800">Test Data:</span>
                          <p className="text-blue-900 mt-1">{tc.test_data}</p>
                        </div>
                        <div className="bg-emerald-50 bg-opacity-50 border border-emerald-100 p-3 rounded">
                          <span className="font-semibold text-emerald-800">Expected Result:</span>
                          <p className="text-emerald-900 mt-1">{tc.expected_result}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
