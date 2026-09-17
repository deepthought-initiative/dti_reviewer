FROM continuumio/miniconda3:latest
WORKDIR /app

# ─── System dependencies (for any C extensions) ───────────────
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*


COPY environment.yml .
RUN conda env create -f environment.yml && conda clean -afy

COPY . .

EXPOSE 5000

ENTRYPOINT ["conda", "run", "--no-capture-output", "-n", "dti_reviewer", "gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
