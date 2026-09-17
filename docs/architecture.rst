Architecture
============

DTI Reviewer follows a modern architecture with a clear separation between the frontend and backend components.

Components
----------

Frontend (React + TypeScript)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The frontend is built using:

- React for the UI framework
- TypeScript for type safety
- Tailwind CSS for styling
- Vite as the build tool

Key features:

- Responsive design
- Real-time expert search
- Interactive results display
- Modern UI components

Backend (Flask + Python)
~~~~~~~~~~~~~~~~~~~~~~~~

The backend consists of:

- Flask web framework
- Similarity engine for expert matching
- RESTful API endpoints
- Data processing pipeline

Key components:

- ``app.py``: Main application entry point
- ``api.py``: API route definitions
- ``similarity_engine.py``: Core matching algorithm

Data Flow
---------

1. User submits a research abstract through the frontend
2. Frontend sends the query to the backend API
3. Backend processes the query using the similarity engine
4. Results are ranked and returned to the frontend
5. Frontend displays the ranked list of experts

Similarity Engine
-----------------

The similarity engine uses:

- TF-IDF vectorization
- Cosine similarity for matching
- Pre-processed author data
- Efficient vector operations
