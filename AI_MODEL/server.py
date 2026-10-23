import json
import pickle
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from transformers import T5ForConditionalGeneration, AutoTokenizer
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from PIL import Image
import io
import pytesseract
import cv2
import sys
import base64
from snip_tool import snip_capture
latest_snip=None

EMB_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
GEN_MODEL = "t5-small"
TOP_K = 6


pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

print("🔄 Loading models and FAISS index...")

embed_model = SentenceTransformer(EMB_MODEL)

index = faiss.read_index("keywords.index")
with open("keywords_meta.pkl", "rb") as f:
    metadata = pickle.load(f)

# Tokenizer should be for GEN_MODEL not EMB_MODEL
tokenizer = AutoTokenizer.from_pretrained(GEN_MODEL)
gen_model = T5ForConditionalGeneration.from_pretrained(GEN_MODEL)


def embed_text(text):
    """Convert input text into normalized embedding."""
    emb = embed_model.encode([text], convert_to_numpy=True)
    faiss.normalize_L2(emb)
    return emb

def retrieve_related(text, topk=TOP_K):
    """Retrieve top-k closest keywords from FAISS index."""
    emb = embed_text(text)
    D, I = index.search(emb, topk)
    result = []
    for idx, score in zip(I[0], D[0]):
        if idx < len(metadata):
            result.append({
                "score": float(score),
                "word": metadata[idx].get("word", ""),
                "page": metadata[idx].get("page", ""),
                "description": metadata[idx].get("description", "")
            })
    return result

def generate_explanation(ocr_text, matches):
    seen_words = set()
    retrieved_text = []

    for m in matches:
        w = m.get("word", "").strip()
        desc = m.get("description", "").strip()
        if w and w not in seen_words:
            retrieved_text.append(f"{w}: {desc}")
            seen_words.add(w)

    context = "|".join(retrieved_text)

    prompt = (
       f" Hello dear, here is your explanation.\n\n"
       f"{ocr_text}\n- {context}\nExplanation:"
    )

    input_ids = tokenizer.encode(prompt, return_tensors="pt", truncation=True, max_length=1024)
    outputs = gen_model.generate(input_ids, max_length=200, num_beams=4, early_stopping=True)
    generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)

    return prompt + "\n" + generated_text


def preprocess_for_ocr(pil_img):
    cv_img = np.array(pil_img)
    cv_img = cv2.cvtColor(cv_img, cv2.COLOR_RGB2GRAY)
    blur=cv2.GaussianBlur(cv_img,(3,3),0)
    thresh=cv2.threshold(blur,0,255,cv2.THRESH_BINARY_INV+cv2.THRESH_OTSU)[1]
    kernel=cv2.getStructuringElement(cv2.MORPH_RECT,(3,3))
    opening=cv2.morphologyEx(thresh,cv2.MORPH_OPEN,kernel,iterations=1)
    invert=255-opening
    return Image.fromarray(invert)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # allow all origins

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json or {}
    # Case 1: Direct text 
    if "text" in data and data["text"].strip():
        ocr_text = data["text"]

    # Case 2: Image 
    elif "image" in data:
        print('call image')
        try:
            img_b64 = data["image"].split(",", 1)[-1] if "," in data["image"] else data["image"]
            img_bytes = base64.b64decode(img_b64)
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            processed_img=preprocess_for_ocr(img)
            ocr_text = pytesseract.image_to_string(processed_img,
                                                   config="--oem 3 --psm 11",lang="eng")
            print(ocr_text)
        except Exception as e:
            print(e)
            return jsonify({"error": f"OCR failed: {str(e)}"}), 500

    else:
        return jsonify({"error": "No text or image provided"}), 400

    # Retrieve related keywords
    matches = retrieve_related(ocr_text, topk=TOP_K)

    # Generate AI explanation
    explanation = generate_explanation(ocr_text, matches)

    return jsonify({
        "ocr_text": ocr_text,
        "matches": matches,
        "explanation": explanation
    })
@app.route("/snip",methods=["GET"])
def snip():
    global latest_snip  
    latest_snip=snip_capture()
    if latest_snip:
        return jsonify({"image":latest_snip})
    return jsonify({"error":"No image capture"}),400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
