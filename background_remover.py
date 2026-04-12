import os
import sys
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

def remove_background(input_path: str, output_path: str, model_name: str = "u2net"):
    """
    Removes the background from an image using the rembg library (based on AI models like U2-Net).
    
    Args:
        input_path (str): Path to the source image.
        output_path (str): Path where the processed image will be saved.
        model_name (str): The rembg model to use. 'u2net' is the default and versatile.
    """
    # Supported extensions for processing
    SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}

    try:
        # 1. Validate input file existence
        input_file = Path(input_path)
        if not input_file.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")

        # 2. Validate file type
        if input_file.suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported file type: {input_file.suffix}. Supported: {SUPPORTED_EXTENSIONS}")

        # 3. Open the image using Pillow
        # Pillow handles the initial decoding of the image format into a raw pixel buffer.
        input_image = Image.open(input_file)

        # 4. Initialize rembg session
        # The AI processing happens here. rembg typically uses U2-Net (Universal U-Square Net).
        # HOW THE AI WORKS:
        # - The model is a Deep Learning architecture designed for Salient Object Detection (SOD).
        # - It uses a "U-Net" style structure: an encoder that captures context and a decoder 
        #   that enables precise localization.
        # - Specifically, U2-Net uses RSU (Reidual U-blocks) which allow the model to extract
        #   features at multiple scales without significantly increasing computational cost.
        # - The model generates a "probability map" (alpha matte) where each pixel's value 
        #   represents the likelihood of it belonging to the foreground object.
        # - Pixels with high probability are kept (alpha=255), low probability are removed (alpha=0),
        #   and mid-values are blended for soft edges (anti-aliasing).
        session = new_session(model_name)

        # 5. Process the image
        # The 'remove' function takes the PIL image, passes it through the AI model's
        # inference engine (ONNX Runtime), and returns a new PIL image with an alpha channel.
        output_image = remove(input_image, session=session)

        # 6. Save the result
        # Note: Output is forced to PNG to preserve the transparency (alpha channel).
        output_file = Path(output_path)
        if output_file.suffix.lower() != '.png':
            print(f"Warning: Output extension changed to .png to support transparency.")
            output_file = output_file.with_suffix('.png')

        output_image.save(output_file)
        print(f"Successfully processed! Saved to: {output_file}")

    except FileNotFoundError as e:
        print(f"Error: {e}")
    except ValueError as e:
        print(f"Error: {e}")
    except Exception as e:
        print(f"An unexpected error occurred during processing: {e}")

if __name__ == "__main__":
    # Basic CLI usage
    if len(sys.argv) < 2:
        print("Usage: python background_remover.py <input_image_path> [output_image_path]")
        sys.exit(1)

    in_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "output_no_bg.png"

    remove_background(in_path, out_path)
