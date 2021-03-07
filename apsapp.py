import numpy as np
import pandas as pd
import pickle
from sklearn.neighbors import NearestNeighbors
from flask import Flask, render_template, request, redirect, jsonify

"""
To run on windows with powershell:
1. Navigate to the directory where apsapp.py is located.
2. Enter: $env:FLASK_APP = "apsapp.py"
3. Enter: python -m flask run
4. Open browser and go to specififed url (probably http://127.0.0.1:5000/)
"""

# ===================================================
# Load required files.
# ===================================================

vectorizerFile = "tfidf_test.pickle" #This file holds the vectorizer
eventsFile = "events_test.pickle" #This file holds a dataframe of events
nnFile = "nearestneighbors_test.pickle" #This file holds a the nearest neighbor information
tMatrixFile = "T_test.pckle" #holds the T matrix from the SVD
nnSVDFile = "nearestneighborsSVD_test.pickle" #holds the NN map of the D matrix from the SVD

with open(vectorizerFile, 'rb') as f:
    v = pickle.load(f)
with open(eventsFile, 'rb') as f:
    events = pickle.load(f)
with open(nnFile, 'rb') as f:
    nn = pickle.load(f)
with open(tMatrixFile, 'rb') as f:
    T = pickle.load(f)
with open(nnSVDFile, 'rb') as f:
    nnSVD = pickle.load(f)

#Converts an event index to a dictionary with four entries:
# title -> The title of the abstract
# abstract -> A shortened version of the abstract
# link -> URL of the event
# score -> Relative score of the event
def index_to_event(index, score,abstractLength=100):
    """Get an event associated with a given index."""
    e = events.iloc[index]
    session = e['session']
    event = e['event']
    year = e['year']
    return {
        'session' : session,
        'event' : str(event),
        'title': e['title'],
        'abstract': e['abstract'][:abstractLength]+"...",
        'score': str(score),
        'link': f'https://meetings.aps.org/Meeting/MAR{year[-2:]}'
                f'/Session/{session}.{event}'
    }

def castQueryIntoTruncatedSubspace(matrix, T):
    """
    An existing SVD can be applied to a new query be performing
    q' = T'^T q where q' and T' are truncated matrcies and
    q is a on column document term matrix.

    Input:
    document is a dense(?) numerical matrix

    T is numerical matricies.

    returns a one column vector .
    """

    return np.dot(np.transpose(T),np.transpose(matrix))

# ===================================================
# Define the app
# ===================================================

app = Flask(__name__)

# Front page for the site; simply render the submission form
@app.route('/')
def home():
    return render_template('index.html')

# Show search results
@app.route('/process', methods=['POST'])
def results():
    #Get the body
    body = request.json if request.json else request.form['abstr']

    #Number of requested results
    num_results = 25

    #Project the text onto the vector space
    input=v.transform([body])
    truncatedInput = np.transpose(castQueryIntoTruncatedSubspace(input.todense(), T))

    #Get the results
    (distSVD,indicesSVD)=nnSVD.kneighbors(truncatedInput, n_neighbors=num_results, return_distance=True)

    resultsSVD = []
    for i, d in zip(indicesSVD[0], distSVD[0]):
        resultsSVD.append(index_to_event(i, round(1-d,3)))

    return render_template('results.html', resultsSVD=resultsSVD, num_resultsSVD=num_results)

if __name__ == '__main__':
    app.run()
