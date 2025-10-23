"""
Clean Modern Design System for OpenLauncher
Minimalist, professional design with subtle animations
"""

from PyQt5.QtWidgets import (QWidget, QPushButton, QGraphicsDropShadowEffect, 
                             QGraphicsOpacityEffect, QFrame)
from PyQt5.QtCore import (QPropertyAnimation, QEasingCurve, Qt, QPoint, 
                          QParallelAnimationGroup, pyqtProperty)
from PyQt5.QtGui import QColor, QPainter, QLinearGradient, QBrush


# Modern Dark Color Palette
class MaterialColors:
    """Professional dark theme"""
    # Main colors - Verde Minecraft
    PRIMARY = "#5cb85c"
    PRIMARY_HOVER = "#6bc76b"
    PRIMARY_PRESSED = "#4cae4c"
    
    # Background colors - Oscuro profesional
    BACKGROUND = "#1a1a1a"
    SURFACE = "#242424"
    SURFACE_HOVER = "#2d2d2d"
    
    # Border and divider
    BORDER = "#3a3a3a"
    DIVIDER = "#2d2d2d"
    
    # Alert colors
    WARNING = "#ffc107"
    ERROR = "#f44336"
    SUCCESS = "#4caf50"
    INFO = "#2196f3"
    
    # Text colors - Todo blanco
    TEXT_PRIMARY = "#ffffff"
    TEXT_SECONDARY = "#b0b0b0"
    TEXT_DISABLED = "#6a6a6a"
    
    # Accent colors
    SUCCESS = "#5cb85c"
    ERROR = "#d9534f"
    WARNING = "#f0ad4e"
    INFO = "#5bc0de"
    
    # Shadows
    SHADOW = "rgba(0, 0, 0, 0.3)"
    SHADOW_HOVER = "rgba(0, 0, 0, 0.5)"


# Modern Dark StyleSheet
MATERIAL_STYLESHEET = f"""
/* Main Window - Dark background */
QMainWindow {{
    background-color: {MaterialColors.BACKGROUND};
}}

/* Dark Card Style */
QFrame.card {{
    background-color: {MaterialColors.SURFACE};
    border-radius: 8px;
    border: 1px solid {MaterialColors.BORDER};
}}

/* Primary Button - Green */
QPushButton.primary {{
    background-color: {MaterialColors.PRIMARY};
    color: #ffffff;
    border: none;
    border-radius: 4px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
}}

QPushButton.primary:hover {{
    background-color: {MaterialColors.PRIMARY_HOVER};
}}

QPushButton.primary:pressed {{
    background-color: {MaterialColors.PRIMARY_PRESSED};
}}

QPushButton.primary:disabled {{
    background-color: {MaterialColors.DIVIDER};
    color: {MaterialColors.TEXT_DISABLED};
}}

/* Outlined Button - Dark with border */
QPushButton.outlined {{
    background-color: {MaterialColors.SURFACE};
    color: {MaterialColors.TEXT_PRIMARY};
    border: 1px solid {MaterialColors.BORDER};
    border-radius: 4px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 400;
}}

QPushButton.outlined:hover {{
    background-color: {MaterialColors.SURFACE_HOVER};
    border-color: {MaterialColors.PRIMARY};
}}

QPushButton.outlined:pressed {{
    background-color: {MaterialColors.DIVIDER};
}}

/* Text Button - Minimal */
QPushButton.text {{
    background-color: transparent;
    color: {MaterialColors.PRIMARY};
    border: none;
    border-radius: 4px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
}}

QPushButton.text:hover {{
    background-color: rgba(92, 184, 92, 0.1);
}}

QPushButton.text:pressed {{
    background-color: rgba(92, 184, 92, 0.15);
}}

/* Default Button - Dark style */
QPushButton {{
    background-color: {MaterialColors.SURFACE};
    color: {MaterialColors.TEXT_PRIMARY};
    border: 1px solid {MaterialColors.BORDER};
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 13px;
}}

QPushButton:hover {{
    background-color: {MaterialColors.SURFACE_HOVER};
    border-color: {MaterialColors.PRIMARY};
}}

QPushButton:pressed {{
    background-color: {MaterialColors.DIVIDER};
}}

/* ComboBox - Dark dropdown */
QComboBox {{
    background-color: {MaterialColors.SURFACE};
    color: {MaterialColors.TEXT_PRIMARY};
    border: 1px solid {MaterialColors.BORDER};
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 13px;
    min-height: 32px;
}}

QComboBox:hover {{
    border-color: {MaterialColors.PRIMARY};
}}

QComboBox:focus {{
    border-color: {MaterialColors.PRIMARY};
    border-width: 2px;
}}

QComboBox::drop-down {{
    border: none;
    width: 24px;
}}

QComboBox::down-arrow {{
    image: none;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid {MaterialColors.TEXT_SECONDARY};
    margin-right: 8px;
}}

QComboBox QAbstractItemView {{
    background-color: {MaterialColors.SURFACE};
    color: {MaterialColors.TEXT_PRIMARY};
    border: 1px solid {MaterialColors.BORDER};
    border-radius: 4px;
    selection-background-color: {MaterialColors.PRIMARY};
    selection-color: #ffffff;
    outline: none;
}}

QComboBox QAbstractItemView::item {{
    padding: 8px 12px;
    min-height: 32px;
}}

QComboBox QAbstractItemView::item:hover {{
    background-color: rgba(92, 184, 92, 0.15);
}}

/* LineEdit - Dark input */
QLineEdit {{
    background-color: {MaterialColors.SURFACE};
    color: {MaterialColors.TEXT_PRIMARY};
    border: 1px solid {MaterialColors.BORDER};
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 13px;
    selection-background-color: {MaterialColors.PRIMARY};
    selection-color: #ffffff;
}}

QLineEdit:hover {{
    border-color: {MaterialColors.PRIMARY};
}}

QLineEdit:focus {{
    border-color: {MaterialColors.PRIMARY};
    border-width: 2px;
}}

/* CheckBox - Clean style */
QCheckBox {{
    color: {MaterialColors.TEXT_PRIMARY};
    spacing: 8px;
    font-size: 13px;
}}

QCheckBox::indicator {{
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: 1px solid {MaterialColors.BORDER};
    background-color: #ffffff;
}}

QCheckBox::indicator:hover {{
    border-color: {MaterialColors.PRIMARY};
}}

QCheckBox::indicator:checked {{
    background-color: {MaterialColors.PRIMARY};
    border-color: {MaterialColors.PRIMARY};
    image: none;
}}

/* Label Styles - Clean typography */
QLabel {{
    color: {MaterialColors.TEXT_PRIMARY};
    font-size: 13px;
}}

QLabel.headline {{
    font-size: 24px;
    font-weight: 600;
    color: {MaterialColors.TEXT_PRIMARY};
}}

QLabel.title {{
    font-size: 18px;
    font-weight: 600;
    color: {MaterialColors.TEXT_PRIMARY};
}}

QLabel.subtitle {{
    font-size: 14px;
    font-weight: 500;
    color: {MaterialColors.TEXT_SECONDARY};
}}

QLabel.body {{
    font-size: 13px;
    color: {MaterialColors.TEXT_PRIMARY};
}}

QLabel.caption {{
    font-size: 12px;
    color: {MaterialColors.TEXT_SECONDARY};
}}

/* ScrollBar Modern Style */
QScrollBar:vertical {{
    background-color: transparent;
    width: 12px;
    margin: 0px;
}}

QScrollBar::handle:vertical {{
    background-color: {MaterialColors.BORDER};
    border-radius: 6px;
    min-height: 30px;
}}

QScrollBar::handle:vertical:hover {{
    background-color: {MaterialColors.PRIMARY};
}}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0px;
}}

QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {{
    background: none;
}}

/* Progress Bar */
QProgressBar {{
    background-color: {MaterialColors.BORDER};
    border: none;
    border-radius: 8px;
    height: 16px;
    text-align: center;
    color: #ffffff;
}}

QProgressBar::chunk {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                               stop:0 {MaterialColors.PRIMARY},
                               stop:1 {MaterialColors.PRIMARY_HOVER});
    border-radius: 8px;
}}

/* Menu Bar */
QMenuBar {{
    background-color: {MaterialColors.SURFACE};
    color: {MaterialColors.TEXT_PRIMARY};
    border-bottom: 1px solid {MaterialColors.BORDER};
    padding: 4px;
}}

QMenuBar::item {{
    padding: 8px 12px;
    border-radius: 8px;
}}

QMenuBar::item:selected {{
    background-color: rgba(103, 80, 164, 0.08);
}}

/* Context Menu */
QMenu {{
    background-color: {MaterialColors.SURFACE};
    color: {MaterialColors.TEXT_PRIMARY};
    border: 1px solid {MaterialColors.BORDER};
    border-radius: 4px;
    padding: 4px;
}}

QMenu::item {{
    padding: 10px 16px;
    border-radius: 8px;
}}

QMenu::item:selected {{
    background-color: {MaterialColors.PRIMARY};
    color: #ffffff;
}}

/* Tooltip */
QToolTip {{
    background-color: {MaterialColors.SURFACE};
    color: {MaterialColors.TEXT_PRIMARY};
    border: 1px solid {MaterialColors.BORDER};
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
}}

/* Message Box */
QMessageBox {{
    background-color: {MaterialColors.SURFACE};
}}

QMessageBox QLabel {{
    color: {MaterialColors.TEXT_PRIMARY};
}}

QMessageBox QPushButton {{
    min-width: 80px;
}}
"""


class MaterialCard(QFrame):
    """Modern Material Design card widget"""
    
    def __init__(self, parent=None, elevated=False):
        super().__init__(parent)
        self.setObjectName("card")
        self.setProperty("class", "card")
        
        # Add shadow effect for elevation
        if elevated:
            shadow = QGraphicsDropShadowEffect()
            shadow.setBlurRadius(20)
            shadow.setXOffset(0)
            shadow.setYOffset(4)
            shadow.setColor(QColor(0, 0, 0, 60))
            self.setGraphicsEffect(shadow)


class AnimatedButton(QPushButton):
    """Button with hover and click animations"""
    
    def __init__(self, text="", parent=None, button_type="primary"):
        super().__init__(text, parent)
        self.setProperty("class", button_type)
        
        # Setup animation
        self.animation = QPropertyAnimation(self, b"geometry")
        self.animation.setDuration(200)
        self.animation.setEasingCurve(QEasingCurve.OutCubic)
        
        # Shadow effect
        self.shadow = QGraphicsDropShadowEffect()
        self.shadow.setBlurRadius(15)
        self.shadow.setXOffset(0)
        self.shadow.setYOffset(2)
        self.shadow.setColor(QColor(0, 0, 0, 80))
        self.setGraphicsEffect(self.shadow)
        
        self._original_geometry = None
    
    def enterEvent(self, event):
        """Animate on hover"""
        if self._original_geometry is None:
            self._original_geometry = self.geometry()
        
        # Lift effect
        new_geo = self.geometry()
        new_geo.moveTop(new_geo.top() - 2)
        
        self.animation.setStartValue(self.geometry())
        self.animation.setEndValue(new_geo)
        self.animation.start()
        
        # Enhance shadow
        self.shadow.setBlurRadius(20)
        self.shadow.setYOffset(4)
        
        super().enterEvent(event)
    
    def leaveEvent(self, event):
        """Return to normal on leave"""
        if self._original_geometry:
            self.animation.setStartValue(self.geometry())
            self.animation.setEndValue(self._original_geometry)
            self.animation.start()
        
        # Reset shadow
        self.shadow.setBlurRadius(15)
        self.shadow.setYOffset(2)
        
        super().leaveEvent(event)


class FadeInWidget(QWidget):
    """Widget with fade-in animation"""
    
    def __init__(self, parent=None, duration=500):
        super().__init__(parent)
        
        self.opacity_effect = QGraphicsOpacityEffect()
        self.setGraphicsEffect(self.opacity_effect)
        
        self.fade_animation = QPropertyAnimation(self.opacity_effect, b"opacity")
        self.fade_animation.setDuration(duration)
        self.fade_animation.setStartValue(0.0)
        self.fade_animation.setEndValue(1.0)
        self.fade_animation.setEasingCurve(QEasingCurve.InOutCubic)
    
    def showEvent(self, event):
        """Start fade-in animation when shown"""
        self.fade_animation.start()
        super().showEvent(event)


class SlideInWidget(QWidget):
    """Widget with slide-in animation"""
    
    def __init__(self, parent=None, direction="left", duration=400):
        super().__init__(parent)
        self.direction = direction
        
        self.slide_animation = QPropertyAnimation(self, b"pos")
        self.slide_animation.setDuration(duration)
        self.slide_animation.setEasingCurve(QEasingCurve.OutCubic)
    
    def showEvent(self, event):
        """Start slide-in animation when shown"""
        start_pos = self.pos()
        
        if self.direction == "left":
            start_pos.setX(start_pos.x() - 100)
        elif self.direction == "right":
            start_pos.setX(start_pos.x() + 100)
        elif self.direction == "top":
            start_pos.setY(start_pos.y() - 100)
        elif self.direction == "bottom":
            start_pos.setY(start_pos.y() + 100)
        
        self.slide_animation.setStartValue(start_pos)
        self.slide_animation.setEndValue(self.pos())
        self.slide_animation.start()
        
        super().showEvent(event)


class RippleEffect(QWidget):
    """Material Design ripple effect for buttons"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAttribute(Qt.WA_TransparentForMouseEvents)
        self.setFixedSize(parent.size())
        
        self._radius = 0
        self._opacity = 1.0
        self._center = QPoint()
        
        # Animation group
        self.animation_group = QParallelAnimationGroup()
        
        # Radius animation
        self.radius_animation = QPropertyAnimation(self, b"radius")
        self.radius_animation.setDuration(600)
        self.radius_animation.setStartValue(0)
        self.radius_animation.setEasingCurve(QEasingCurve.OutCubic)
        
        # Opacity animation
        self.opacity_animation = QPropertyAnimation(self, b"opacity")
        self.opacity_animation.setDuration(600)
        self.opacity_animation.setStartValue(1.0)
        self.opacity_animation.setEndValue(0.0)
        self.opacity_animation.setEasingCurve(QEasingCurve.OutCubic)
        
        self.animation_group.addAnimation(self.radius_animation)
        self.animation_group.addAnimation(self.opacity_animation)
        self.animation_group.finished.connect(self.hide)
    
    @pyqtProperty(float)
    def radius(self):
        return self._radius
    
    @radius.setter
    def radius(self, value):
        self._radius = value
        self.update()
    
    @pyqtProperty(float)
    def opacity(self):
        return self._opacity
    
    @opacity.setter
    def opacity(self, value):
        self._opacity = value
        self.update()
    
    def start_ripple(self, pos):
        """Start ripple effect at position"""
        self._center = pos
        max_radius = max(self.width(), self.height())
        self.radius_animation.setEndValue(max_radius)
        
        self.show()
        self.raise_()
        self.animation_group.start()
    
    def paintEvent(self, event):
        """Draw the ripple"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        color = QColor(MaterialColors.PRIMARY)
        color.setAlphaF(self._opacity * 0.3)
        painter.setBrush(QBrush(color))
        painter.setPen(Qt.NoPen)
        
        painter.drawEllipse(self._center, int(self._radius), int(self._radius))


def apply_material_theme(app):
    """Apply Material Design theme to the application"""
    app.setStyleSheet(MATERIAL_STYLESHEET)
    
    # Set application-wide font
    from PyQt5.QtGui import QFont
    font = QFont("Segoe UI", 10)
    app.setFont(font)


def create_gradient_background(widget, start_color, end_color):
    """Create a gradient background for a widget"""
    gradient = QLinearGradient(0, 0, 0, widget.height())
    gradient.setColorAt(0, QColor(start_color))
    gradient.setColorAt(1, QColor(end_color))
    
    palette = widget.palette()
    palette.setBrush(widget.backgroundRole(), QBrush(gradient))
    widget.setPalette(palette)
    widget.setAutoFillBackground(True)