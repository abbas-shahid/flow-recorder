
import { useCallback, useEffect, useState } from 'react'
import './App.css'

interface RecordedStep {
  type: string
  tag?: string
  selector?: string
  value?: string | boolean
  text?: string
  timestamp: number
}

interface Workflow {
  id: string
  origin: string
  path: string
  pageKey: string
  steps: RecordedStep[]
  createdAt: number
  updatedAt: number
}

function App() {
  const [recording, setRecording] = useState(false)
  const [message, setMessage] = useState('')
  const [recordedSteps, setRecordedSteps] = useState<RecordedStep[]>([])
  const [workflow, setWorkflow] = useState<Workflow | null>(null)

  const [showUpdateConfirmation, setShowUpdateConfirmation] = useState(false)
  const [showClearConfirmation, setShowClearConfirmation] = useState(false)

  const loadCurrentWorkflow = useCallback(() => {
    chrome.runtime.sendMessage(
      { action: 'GET_CURRENT_WORKFLOW' },
      (response) => {
        if (chrome.runtime.lastError) {
          setMessage(chrome.runtime.lastError.message || 'Could not load workflow.')
          return
        }

        if (response?.success) {
          setWorkflow(response.workflow || null)
          setRecordedSteps(response.steps || [])
        } else {
          setWorkflow(null)
          setRecordedSteps([])
          setMessage(response?.message || 'Could not load workflow.')
        }
      }
    )
  }, [])

  useEffect(() => {
    chrome.storage.local
      .get(['isRecording', 'recordingError'])
      .then((result) => {
        setRecording(result.isRecording === true)
        if (typeof result.recordingError === 'string') {
          setMessage(result.recordingError)
        }
      })

    loadCurrentWorkflow()

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange }
    ) => {
      if (changes.isRecording) {
        setRecording(changes.isRecording.newValue === true)
      }

      if (changes.workflows) {
        loadCurrentWorkflow()
      }

      if (changes.recordingError) {
        setMessage(
          typeof changes.recordingError.newValue === 'string'
            ? changes.recordingError.newValue
            : ''
        )
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [loadCurrentWorkflow])

  const handleRecording = (
    action: 'START_RECORDING' | 'STOP_RECORDING'
  ) => {
    setMessage('')

    chrome.runtime.sendMessage({ action }, (response) => {
      if (chrome.runtime.lastError) {
        setMessage(chrome.runtime.lastError.message || 'Something went wrong.')
        return
      }

      if (response?.success) {
        setRecording(action === 'START_RECORDING')
        setMessage(response.message)
        loadCurrentWorkflow()
      } else {
        setMessage(response?.message || 'Something went wrong.')
      }
    })
  }

  const handleReplay = () => {
    setMessage('')

    if (!workflow || recordedSteps.length === 0) {
      setMessage('No saved workflow exists for this page.')
      return
    }

    chrome.runtime.sendMessage(
      { action: 'REPLAY_WORKFLOW' },
      (response) => {
        if (chrome.runtime.lastError) {
          setMessage(chrome.runtime.lastError.message || 'Replay failed.')
          return
        }

        setMessage(response?.message || 'Replay failed.')
      }
    )
  }

  const handleConfirmUpdate = () => {
    setMessage('')

    chrome.runtime.sendMessage(
      { action: 'UPDATE_WORKFLOW' },
      (response) => {
        if (chrome.runtime.lastError) {
          setMessage(chrome.runtime.lastError.message || 'Update failed.')
          return
        }

        setMessage(response?.message || 'Update failed.')
        setShowUpdateConfirmation(false)

        if (response?.success) {
          loadCurrentWorkflow()
        }
      }
    )
  }

  const handleConfirmClear = () => {
    setMessage('')

    chrome.runtime.sendMessage(
      { action: 'CLEAR_WORKFLOW' },
      (response) => {
        if (chrome.runtime.lastError) {
          setMessage(chrome.runtime.lastError.message || 'Clear failed.')
          return
        }

        setMessage(response?.message || 'Could not clear workflow.')
        setShowClearConfirmation(false)

        if (response?.success) {
          loadCurrentWorkflow()
        }
      }
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">FR</div>
        <div>
          <h1>FlowRecorder</h1>
          <p>Browser workflow automation</p>
        </div>
      </header>

      <section className="recording-section">
        <div className="status">
          <span className="status-dot"></span>
          {recording ? 'Recording...' : 'Ready to record'}
        </div>

        <h2>Browser Workflow</h2>

        {workflow ? (
          <p>Saved workflow: {workflow.path}</p>
        ) : (
          <p>No workflow saved for this page yet.</p>
        )}

        <button
          className="record-button"
          onClick={() =>
            handleRecording(
              recording ? 'STOP_RECORDING' : 'START_RECORDING'
            )
          }
          disabled={recording && !workflow}
        >
          {recording ? 'Stop Recording' : 'Start Recording'}
        </button>

        <button
          className="record-button"
          onClick={handleReplay}
          disabled={recording || !workflow || recordedSteps.length === 0}
        >
          Replay Workflow
        </button>

        <button
          className="update-button"
          onClick={() => {
            setMessage('')
            setShowUpdateConfirmation(true)
          }}
          disabled={recording || !workflow || recordedSteps.length === 0}
        >
          Update Workflow
        </button>

        <button
          className="clear-button"
          onClick={() => {
            setMessage('')
            setShowClearConfirmation(true)
          }}
          disabled={recording || !workflow}
        >
          Clear Workflow
        </button>

        {message && <p>{message}</p>}
      </section>

      <section className="workflows-section">
        <h2>Recorded Steps ({recordedSteps.length})</h2>

        {recordedSteps.length === 0 ? (
          <div className="empty-state">
            <p>No steps recorded yet.</p>
            <span>Start recording and interact with a website.</span>
          </div>
        ) : (
          <div className="steps-list">
            {recordedSteps.map((step, index) => (
              <div className="step-item" key={`${step.timestamp}-${index}`}>
                <div className="step-heading">
                  <strong>
                    {index + 1}. {step.type.toUpperCase()}
                  </strong>
                  <span>{step.tag}</span>
                </div>

                {step.type === 'input' && (
                  <>
                    <p>Selector: {step.selector}</p>
                    <p>
                      Value: {
                        typeof step.value === 'boolean'
                          ? step.value ? 'Checked' : 'Unchecked'
                          : step.value
                      }
                    </p>
                  </>
                )}

                {step.type === 'click' && (
                  <p>Button: {step.text || 'Unnamed button'}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {showClearConfirmation && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog">
            <h3>Clear saved workflow?</h3>

            <p>
              This will permanently delete the saved workflow
              for this page. Other page workflows will remain unchanged.
            </p>

            <p>Are you sure you want to continue?</p>

            <div className="confirmation-actions">
              <button
                onClick={() => setShowClearConfirmation(false)}
              >
                Cancel
              </button>

              <button onClick={handleConfirmClear}>
                Clear Workflow
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpdateConfirmation && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog">
            <h3>Update saved workflow?</h3>

            <p>
              This will replace the existing recorded values with
              the current values from the webpage.
            </p>

            <p>Are you sure you want to continue?</p>

            <div className="confirmation-actions">
              <button
                onClick={() => setShowUpdateConfirmation(false)}
              >
                Cancel
              </button>

              <button onClick={handleConfirmUpdate}>
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      <footer>FlowRecorder v1.0.0</footer>
    </div>
  )
}

export default App
