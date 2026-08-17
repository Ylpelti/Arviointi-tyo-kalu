# AI Assessment Tool

AI-assisted grading tool for evaluating student answers against predefined assignment-specific criteria.

The application was built for my own teaching workflow. A teacher selects an assignment in a Chrome extension, pastes a student's answer, and sends it to a FastAPI backend for evaluation.

Each assignment has predefined grading criteria and point allocations. The backend combines these with the student's response and sends the structured evaluation prompt to the OpenAI API. The response contains category-specific scores, strengths, areas for improvement, and a feedback text for the student.

The model is instructed to evaluate only the content found in the student's answer and to return the result in a structured JSON format.

## Tech Stack

* Python
* FastAPI
* OpenAI API
* Chrome Extension Manifest V3
* JavaScript
* HTML / CSS

## Development

I built the application using Codex despite having no previous experience developing Chrome extensions. The project was mainly an experiment in using AI coding tools to turn a real workflow problem into a functional application.

## Current Limitations

* Grading rubrics are currently defined manually in JSON.
* The backend runs locally.
* Only OpenAI models are currently supported.
* The tool is a prototype and AI-generated grading should be reviewed by the teacher.
* Privacy and anonymisation would need additional consideration before handling identifiable student data in production.
