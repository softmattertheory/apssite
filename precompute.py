import os
import json
import pickle
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors

#datafiles to import
#datafiles = ["formattedForWebsite2019Abstracts.json","formattedForWebsite2020Abstracts.json"]
datafiles = ["formattedForWebsite2021Abstracts.json"]

#datafiles to export
vectorizerFile = "tfidf_test.pickle" #This file will hold the vectorizer
eventsFile = "events_test.pickle" #This file will hold a dataframe of events
nnFile = "nearestneighbors_test.pickle" #This file will hold a the nearest neighbor information
tMatrixFile = "T_test.pckle" #To hold the T matrix from the SVD
nnSVDFile = "nearestneighborsSVD_test.pickle" #To hold the NN map of the D matrix from the SVD

vectorizerOps = {'max_features': None, #consider only top N words for vocabulary, None does not limit
                 'min_df': .005, #minmum percent of docs needed to have a word for it to be considered (ignoring very rare words)
                 'max_df': .90, #maximum percent of docs needed to have a word for it to be ignored (ignoring very common words)
                 'ngram_range':(1,4), #length of words combinations to look for
                 'stop_words':'english'} #special list of words to be ignored (words like 'the' or 'is')


#Importing the data
print("Importing data files")
data = []
for file in datafiles:
    print(f"{file} imported succesfully")
    with open(os.path.join("data",file),"r",encoding='utf_8') as f:
        data += json.loads(f.read())['events']
print(f"{len(data)} events imported")


#Filtering the data
print("Filtering data files")
#Requiring abstracts to be a certain length
print("Culling short data files")
minLen = 200
filteredData = []
for event in data:
    if len(event['abstract']) >= minLen:
        filteredData.append(event)
print(f"{len(filteredData)}/{len(data)} selected")

print("Converting datafiles to DataFrame")
events = pd.DataFrame(filteredData)


#Converting data into a word frequency vector space
print("Initialzing Tfidf Vectorizer")
v = TfidfVectorizer(**vectorizerOps)

print("Computing embedding")
embedding = np.asarray(
        v.fit_transform(events['title'] + events['abstract']).todense()).tolist()
print(f"Vector space is composed of {len(v.get_feature_names())} features.")


#Compose neighbor graph of embedding
print("Computing nearest neighbors")
nn = NearestNeighbors(metric='cosine')
nn.fit(embedding)


def computeTruncatedSVD(docTermMatrix, dim=500):
    """
    Perform singular values decomposisiton on a document term
    matrix A.

    A = T S D^T
    A ~ T'S'D'^T

    Where T', S', and D' have a fewer columns than T, S, and D.

    Inputs:
    docTermMatrix is a dense matrix of postive floats or integers.
    It has a row for every document in the corpus and a column for
    every word being used for comparison. This is technically the
    transpose of a document term matrix which is why before we find
    the SVD we take the transpose.

    dim (optional) is the dimension of the reduced subspace. If the
    value is larger than the dimension of the full order matricies,
    the full order matricies will be used.

    returns
    T' an square matrix with dimensions equal to number of words in
    the document term matrix.
    S' a diagonal square matrix with dimensions is equal to the number of documents.
    D' a square matrix with dimensions equal to the number of documents.
    """
    T, S, D = np.linalg.svd(np.transpose(docTermMatrix), full_matrices=False)

    diagS = np.diag(S)
    shape = np.shape(diagS)

    if dim <= shape[0] and dim <= shape[1]:
        subT = T[:,:dim]
        subS = diagS[:dim,:dim]
        subD = np.transpose(D)[:,:dim]
    else:
        subT = T
        subS = diagS
        subD = np.transpose(D)

    return subT, subS, subD

T,S,D = computeTruncatedSVD(embedding, dim=500)

nnSVD = NearestNeighbors(metric='cosine') #Compose neighbor graph of embedding
nnSVD.fit(D)


#Export the data
print("Exporting data")
with open(vectorizerFile, mode='wb') as f:
        pickle.dump(v,f)
        print("Vectorizer export successful")
with open(eventsFile, mode='wb') as f:
        pickle.dump(events,f)
        print("Events export successful")
with open(nnFile, mode='wb') as f:
        pickle.dump(nn,f)
        print("Nearest neighbors export successful")
with open(tMatrixFile, mode='wb') as f:
        pickle.dump(T,f)
        print("T Matrix export successful")
with open(nnSVDFile, mode='wb') as f:
        pickle.dump(nnSVD,f)
        print("Nearest neighbors for SVD export successful")
