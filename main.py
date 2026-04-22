from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

import models
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Hostel Management System")

# Pydantic Schemas
class RoomCreate(BaseModel):
    room_number: str
    capacity: int
    price: int = 0

class RoomResponse(BaseModel):
    id: int
    room_number: str
    capacity: int
    price: int
    current_occupancy: int

    class Config:
        from_attributes = True

class StudentCreate(BaseModel):
    name: str
    email: str
    room_id: Optional[int] = None

class StudentResponse(BaseModel):
    id: int
    name: str
    email: str
    room_id: Optional[int]

    class Config:
        from_attributes = True

class BookingInfo(BaseModel):
    room_number: str
    status: str

class StudentPortalResponse(BaseModel):
    id: int
    name: str
    email: str
    room_number: Optional[str]
    capacity: Optional[int]
    roommates: List[str]
    bookings: List[BookingInfo] = []

class BookingCreate(BaseModel):
    student_name: str
    student_email: str
    room_id: int

class BookingResponse(BaseModel):
    id: int
    student_name: str
    student_email: str
    room_id: int
    status: str
    room_number: str

    class Config:
        from_attributes = True

class BookingUpdate(BaseModel):
    status: str

class NoticeCreate(BaseModel):
    title: str
    content: str

class NoticeResponse(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime   # ✅ FIXED

    class Config:
        from_attributes = True

# API Endpoints
@app.get("/api/rooms", response_model=List[RoomResponse])
def get_rooms(db: Session = Depends(get_db)):
    rooms = db.query(models.Room).all()
    # Pydantic will access current_occupancy automatically thanks to from_attributes
    return rooms

@app.post("/api/rooms", response_model=RoomResponse)
def create_room(room: RoomCreate, db: Session = Depends(get_db)):
    db_room = db.query(models.Room).filter(models.Room.room_number == room.room_number).first()
    if db_room:
        raise HTTPException(status_code=400, detail="Room already exists")
    new_room = models.Room(room_number=room.room_number, capacity=room.capacity, price=room.price)
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    return new_room

@app.get("/api/students", response_model=List[StudentResponse])
def get_students(db: Session = Depends(get_db)):
    return db.query(models.Student).all()

@app.post("/api/students", response_model=StudentResponse)
def create_student(student: StudentCreate, db: Session = Depends(get_db)):
    db_student = db.query(models.Student).filter(models.Student.email == student.email).first()
    if db_student:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if room can accommodate
    if student.room_id:
        room = db.query(models.Room).filter(models.Room.id == student.room_id).first()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        if room.current_occupancy >= room.capacity:
            raise HTTPException(status_code=400, detail="Room is at full capacity")

    new_student = models.Student(
        name=student.name, 
        email=student.email, 
        room_id=student.room_id
    )
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    return new_student

# Serve Frontend SPA
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_index():
    return FileResponse("index.html")

@app.get("/customer")
def read_customer():
    return FileResponse("customer.html")

@app.get("/api/student-portal/{email}", response_model=StudentPortalResponse)
def get_student_portal(email: str, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.email == email).first()
    bookings_db = db.query(models.Booking).filter(models.Booking.student_email == email).all()
    
    if not student and not bookings_db:
        raise HTTPException(status_code=404, detail="Student/Booking not found")
        
    room_number = None
    capacity = None
    roommates = []
    
    name = student.name if student else bookings_db[0].student_name
    student_id = student.id if student else 0
    
    if student and student.room:
        room_number = student.room.room_number
        capacity = student.room.capacity
        roommates_db = db.query(models.Student).filter(
            models.Student.room_id == student.room_id,
            models.Student.id != student.id
        ).all()
        roommates = [r.name for r in roommates_db]
        
    bookings_out = []
    for b in bookings_db:
        bookings_out.append({"room_number": b.room.room_number, "status": b.status})

    return {
        "id": student_id,
        "name": name,
        "email": email,
        "room_number": room_number,
        "capacity": capacity,
        "roommates": roommates,
        "bookings": bookings_out
    }

@app.post("/api/bookings", response_model=BookingResponse)
def create_booking(booking: BookingCreate, db: Session = Depends(get_db)):
    room = db.query(models.Room).filter(models.Room.id == booking.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.current_occupancy >= room.capacity:
        raise HTTPException(status_code=400, detail="Room is full")
        
    new_booking = models.Booking(
        student_name=booking.student_name,
        student_email=booking.student_email,
        room_id=booking.room_id
    )
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    
    # Return with room_number computed
    return {
        "id": new_booking.id,
        "student_name": new_booking.student_name,
        "student_email": new_booking.student_email,
        "room_id": new_booking.room_id,
        "status": new_booking.status,
        "room_number": room.room_number
    }

@app.get("/api/bookings", response_model=List[BookingResponse])
def get_bookings(db: Session = Depends(get_db)):
    bookings = db.query(models.Booking).all()
    res = []
    for b in bookings:
        res.append({
            "id": b.id,
            "student_name": b.student_name,
            "student_email": b.student_email,
            "room_id": b.room_id,
            "status": b.status,
            "room_number": b.room.room_number
        })
    return res

@app.put("/api/bookings/{booking_id}")
def update_booking(booking_id: int, update: BookingUpdate, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    booking.status = update.status
    
    # If approved, add student to room (if space allows)
    if update.status == "Approved":
        room = db.query(models.Room).filter(models.Room.id == booking.room_id).first()
        if room.current_occupancy >= room.capacity:
            booking.status = "Rejected (Full)"
        else:
            # check if student exists by email
            student = db.query(models.Student).filter(models.Student.email == booking.student_email).first()
            if student:
                student.room_id = booking.room_id
            else:
                new_student = models.Student(name=booking.student_name, email=booking.student_email, room_id=booking.room_id)
                db.add(new_student)
                
    db.commit()
    return {"status": booking.status}

@app.get("/api/notices", response_model=List[NoticeResponse])
def get_notices(db: Session = Depends(get_db)):
    return db.query(models.Notice).order_by(models.Notice.id.desc()).all()

@app.post("/api/notices", response_model=NoticeResponse)
def create_notice(notice: NoticeCreate, db: Session = Depends(get_db)):
    new_notice = models.Notice(
        title=notice.title,
        content=notice.content,
        created_at=datetime.now()   # ✅ FIXED
    )
    db.add(new_notice)
    db.commit()
    db.refresh(new_notice)
    return new_notice

@app.delete("/api/notices/{notice_id}")
def delete_notice(notice_id: int, db: Session = Depends(get_db)):
    notice = db.query(models.Notice).filter(models.Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    db.delete(notice)
    db.commit()
    return {"detail": "Notice deleted"}
