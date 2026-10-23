import sys
import io
import base64
from PyQt5.QtWidgets import QApplication, QWidget
from PyQt5.QtGui import QPainter, QPen, QGuiApplication
from PyQt5.QtCore import Qt, QRect
from PIL import Image


def snip_capture():

    app = QApplication(sys.argv)
    snip_base64 = None

    class SnippingTool(QWidget):
        def __init__(self):
            super().__init__()
            self.setWindowFlags(Qt.WindowStaysOnTopHint | Qt.FramelessWindowHint)
            self.showFullScreen()
            self.setWindowOpacity(0.3)  
            self.begin = None
            self.end = None
            self.selection = None

        def paintEvent(self, event):
            if self.begin and self.end:
                qp = QPainter(self)
                qp.setPen(QPen(Qt.cyan, 2, Qt.DashLine))
                rect = QRect(self.begin, self.end)
                qp.drawRect(rect.normalized())

        def mousePressEvent(self, event):
            self.begin = event.pos()
            self.end = self.begin
            self.update()

        def mouseMoveEvent(self, event):
            self.end = event.pos()
            self.update()

        def mouseReleaseEvent(self, event):
            nonlocal snip_base64
            self.end = event.pos()
            self.selection = QRect(self.begin, self.end).normalized()

            screen = QGuiApplication.primaryScreen()
            screenshot = screen.grabWindow(0)
            dpr = screen.devicePixelRatio()

            rect = self.selection
            scaled_rect = QRect(
                int(rect.x() * dpr),
                int(rect.y() * dpr),
                int(rect.width() * dpr),
                int(rect.height() * dpr)
            )

            cropped = screenshot.copy(scaled_rect)

            image = cropped.toImage()
            width, height = image.width(), image.height()
            ptr = image.bits()
            ptr.setsize(image.byteCount())

            pil_img = Image.frombuffer("RGBA", (width, height), bytes(ptr), "raw", "BGRA", 0, 1)

            buffer = io.BytesIO()
            pil_img.save(buffer, format="PNG", dpi=(300, 300))
            snip_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

            self.close()

    snipper = SnippingTool()
    snipper.show()
    app.exec_()
    return snip_base64


if __name__ == "__main__":
    img = snip_capture()
    if img:
        print("Snip captured successfully!")