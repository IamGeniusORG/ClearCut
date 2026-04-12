import streamlit as st
from PIL import Image
from rembg import remove, new_session
import io
import zipfile
from pathlib import Path

# Page configuration for a modern look
st.set_page_config(page_title="Batch AI Background Remover", page_icon="✂️", layout="wide")

def process_single_image(image_bytes, session):
    """
    Processes a single image and returns the transparent PIL image.
    """
    input_image = Image.open(image_bytes)
    # The rembg 'remove' function performs the AI inference using the provided session
    output_image = remove(input_image, session=session)
    return output_image

def main():
    st.title("✂️ Batch AI Background Remover")
    st.markdown("""
    Upload multiple images to remove backgrounds in bulk. 
    The app uses **U2-Net** to extract objects and will package all results into a single **.zip** file.
    """)

    # Sidebar for bulk upload
    st.sidebar.header("Batch Upload")
    uploaded_files = st.sidebar.file_uploader(
        "Choose JPG or PNG files", 
        type=["jpg", "jpeg", "png"], 
        accept_multiple_files=True
    )

    if uploaded_files:
        st.info(f"Loaded {len(uploaded_files)} images. Click 'Process Batch' to start.")
        
        if st.button("Process Batch"):
            # Initialize a single session to be reused for all images (more efficient)
            session = new_session("u2net")
            
            # Prepare an in-memory ZIP file
            zip_buffer = io.BytesIO()
            
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            # Use columns for a grid-like preview of processed images
            preview_cols = st.columns(4)
            
            with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED) as zip_file:
                for idx, uploaded_file in enumerate(uploaded_files):
                    status_text.text(f"Processing {uploaded_file.name}...")
                    
                    # Remove background
                    processed_img = process_single_image(uploaded_file, session)
                    
                    # Save to ZIP
                    img_buf = io.BytesIO()
                    processed_img.save(img_buf, format="PNG")
                    zip_file.writestr(f"{Path(uploaded_file.name).stem}_no_bg.png", img_buf.getvalue())
                    
                    # Update Progress
                    progress = (idx + 1) / len(uploaded_files)
                    progress_bar.progress(progress)
                    
                    # Show a small preview in the grid
                    with preview_cols[idx % 4]:
                        st.image(processed_img, caption=f"Done: {uploaded_file.name}", use_container_width=True)

            status_text.success(f"Successfully processed {len(uploaded_files)} images!")
            
            # Provide the ZIP for download
            st.sidebar.markdown("---")
            st.sidebar.download_button(
                label="Download All as ZIP",
                data=zip_buffer.getvalue(),
                file_name="processed_images.zip",
                mime="application/zip",
                use_container_width=True
            )
    else:
        st.info("Upload one or more images in the sidebar to begin batch processing.")

if __name__ == "__main__":
    main()
