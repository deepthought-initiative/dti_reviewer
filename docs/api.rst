API Reference
=============

The DTI Reviewer API provides endpoints for expert search.

Summary Table
~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1

   * - Endpoint
     - Method
     - Description
   * - ``/search``
     - POST
     - Submit a search query
   * - ``/status/<task_id>``
     - GET
     - Get the status/results for the task


Endpoints
~~~~~~~~~

Search Experts
--------------

Find experts based on a research abstract.

**POST** ``/search``

Submit a research abstract or topic to search for similar experts.

**Request**

.. code-block:: http

   POST /search
   Content-Type: application/json

   {
     "query": "Your research abstract text here..."
   }

**Response** (202 Accepted)

.. code-block:: json

   {
     "message": "Task submitted",
     "task_id": "some-task-id"
   }

**Error responses:**

- ``400 Bad Request`` if ``query`` is missing, empty, or too short.

  .. code-block:: json

     {
       "message": "Missing 'query' parameter",
       "results": []
     }

  .. code-block:: json

     {
       "message": "Query cannot be empty",
       "results": []
     }

  .. code-block:: json

     {
       "message": "Query too short. Minimum 3 characters",
       "results": []
     }

- ``500 Internal Server Error`` if the task could not be enqueued.

**Parameters:**

- ``query`` (string, required): The research abstract or topic to search with.

Check Task Status
~~~~~~~~~~~~~~~~~

Check the progress or results of a search task.

**GET** ``/status/<task_id>``

Poll this endpoint to retrieve the status and results for your submitted search.

**Response:**

- While processing:

  .. code-block:: json

     {
       "state": "PENDING"
     }

  .. code-block:: json

     {
       "state": "PROGRESS",
       "percent": 67
     }

- On success:

  .. code-block:: json

     {
       "state": "SUCCESS",
       "results": [
         {
           "orcid": "A",
           "author": "Alice",
           "similarity": 1.0,
           "name_variations": ["Alice"]
         }
       ]
     }

- On error:

  .. code-block:: json

     {
       "state": "FAILURE",
       "message": "Error message here"
     }

- **HTTP Status codes:**
  - 202 Accepted for ``PENDING`` and ``PROGRESS``
  - 200 OK for ``SUCCESS``
  - 500 Internal Server Error for other failures

Response Fields
~~~~~~~~~~~~~~~

- ``message`` (string): Status or error message
- ``task_id`` (string): Task identifier (on ``/search``)
- ``state`` (string): Task state: ``"PENDING"``, ``"PROGRESS"``, ``"SUCCESS"``, ``"FAILURE"``
- ``percent`` (number): Progress percentage (if available)
- ``results`` (array): List of experts (on success), with fields:
  - ``orcid`` (string): ORCID identifier
  - ``author`` (string): Name of the expert
  - ``similarity`` (number): Similarity score
  - ``name_variations`` (array): Other name variations
