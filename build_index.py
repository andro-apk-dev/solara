import pandas as pd
from sentence_transformers import SentenceTransformer
import faiss
import pickle

CSV_PATH = 'keywords.csv'
EMB_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

def build_text(row):
    word = str(row['word']).strip() if pd.notna(row['word']) else ""
    desc = str(row['description']).strip() if pd.notna(row['description']) else ""
    
    if not word and not desc:
        return ""
    
    # Check number of words in the "word" field
    word_count = len(word.split())
    
    if word_count > 1:  
        # If it's a phrase, make description more appealing
        if desc:
            desc = f"{desc}. This phrase generally means '{word}'."
        else:
            desc = f"This phrase generally means '{word}'."
    return ". ".join([part for part in [word, desc] if part])

def main():
    # Load CSV
    df = pd.read_csv(CSV_PATH, quotechar='"')
    
    # Build clean & appealing text field
    df['text'] = df.apply(build_text, axis=1)
    
    # Convert to list
    texts = df['text'].tolist()
    
    # Load embedding model
    model = SentenceTransformer(EMB_MODEL)
    
    # Encode texts
    embeddings = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
    
    # Build FAISS index
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    faiss.normalize_L2(embeddings)
    index.add(embeddings)
    
    # Save FAISS index
    faiss.write_index(index, "keywords.index")
    
    # Save metadata
    with open("keywords_meta.pkl", "wb") as f:
        pickle.dump(df.to_dict(orient="records"), f)
    
    print("✅ Saved FAISS index and metadata successfully!")

if __name__ == "__main__":
    main()
