import React from 'react'
import ReactDOM from 'react-dom/client'
import ErrorBoundary, { FatalScreen } from './ui/ErrorBoundary'

const root = ReactDOM.createRoot(document.getElementById('root')!)

// App is loaded dynamically so that an error thrown while its modules
// initialise (for example a corrupt save read at import time) is caught
// here and shown, instead of leaving a black page.
import('./ui/App')
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    )
  })
  .catch(error => {
    console.error('Cursed Squad failed to start:', error)
    root.render(<FatalScreen error={error} />)
  })
