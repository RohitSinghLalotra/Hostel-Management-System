from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String, unique=True, index=True, nullable=False)
    capacity = Column(Integer, nullable=False)
    price = Column(Integer, default=0)
    
    students = relationship("Student", back_populates="room")

    @property
    def current_occupancy(self):
        return len(self.students)

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    
    room = relationship("Room", back_populates="students")

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String, nullable=False)
    student_email = Column(String, nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    status = Column(String, default="Pending") # Pending, Approved, Rejected

    room = relationship("Room")

class Notice(Base):
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(String, nullable=False) # Simple string for brevity in this MVP
