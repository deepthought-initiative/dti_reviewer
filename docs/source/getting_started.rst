Getting Started
===============

This guide will help you get Deep Reviewer up and running on your local machine.

Installation
------------

1. Clone the repository:

   .. code-block:: bash

      git clone https://github.com/yourusername/expert-finder.git
      cd expert-finder

2. Set up the backend:

   .. code-block:: bash

      cd deepreviewer/backend
      conda env create -f environment.yml
      conda activate expert-finder

3. Set up the frontend:

   .. code-block:: bash

      cd dti_reviewer/frontend
      npm install

Running the Application
-----------------------

1. Start the backend server:

   .. code-block:: bash

      cd deepreviewer/backend
      flask --app app run

   The api would be running at http://127.0.0.1:5000

2. Start the frontend development server:

   .. code-block:: bash

      cd dti_reviewer/frontend
      npm run dev

3. Access the frontend application at http://localhost:5173

Using Docker
------------

Alternatively, you can run the entire application using Docker Compose:

.. code-block:: bash

   docker-compose up --build

The application will be available at http://localhost:3000
