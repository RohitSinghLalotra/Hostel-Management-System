document.addEventListener('DOMContentLoaded', () => {

    // ==== Navigation ====
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active-view'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active-view');
            
            if(targetId === 'rooms-view') fetchRooms();
            if(targetId === 'students-view') fetchStudents();
            if(targetId === 'bookings-view') fetchBookings();
            if(targetId === 'notices-view') fetchNotices();
            if(targetId === 'dashboard-view') fetchDashboardStats();
        });
    });

    // ==== Modal Logic ====
    const setupModal = (btnId, modalId, formId) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        const closeBtn = modal.querySelector('.close-btn');

        btn.addEventListener('click', () => {
            modal.classList.add('active');
            if(modalId === 'student-modal') populateRoomSelect();
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        modal.addEventListener('click', (e) => {
            if(e.target === modal) modal.classList.remove('active');
        });
    };

    setupModal('open-room-modal', 'room-modal', 'room-form');
    setupModal('open-student-modal', 'student-modal', 'student-form');

    // ==== API Integration ====
    const API_BASE = '/api';

    async function fetchDashboardStats() {
        try {
            const [roomsRes, studentsRes] = await Promise.all([
                fetch(`${API_BASE}/rooms`),
                fetch(`${API_BASE}/students`)
            ]);
            const rooms = await roomsRes.json();
            const students = await studentsRes.json();

            document.getElementById('stat-total-rooms').innerText = rooms.length;
            document.getElementById('stat-total-students').innerText = students.length;

            const totalCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);
            const totalOccupancy = rooms.reduce((acc, r) => acc + r.current_occupancy, 0);
            
            document.getElementById('stat-available-capacity').innerText = totalCapacity - totalOccupancy;

        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }

    async function fetchRooms() {
        try {
            const res = await fetch(`${API_BASE}/rooms`);
            const rooms = await res.json();
            
            const container = document.getElementById('rooms-list');
            container.innerHTML = '';
            
            rooms.forEach(room => {
                const fillPercent = (room.current_occupancy / room.capacity) * 100;
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <div class="card-title">Room ${room.room_number}</div>
                    <div style="color: #00d2ff; font-weight:bold; margin-bottom: 0.5rem;">$${room.price || 0}</div>
                    <div class="card-subtitle">Capacity: ${room.capacity}</div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${fillPercent}%"></div>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); text-align: right;">
                        ${room.current_occupancy} / ${room.capacity} Occupied
                    </div>
                `;
                container.appendChild(card);
            });
        } catch (error) {
            console.error('Error fetching rooms:', error);
        }
    }

    async function fetchStudents() {
        try {
            const [stuRes, roomRes] = await Promise.all([
                fetch(`${API_BASE}/students`),
                fetch(`${API_BASE}/rooms`)
            ]);
            const students = await stuRes.json();
            const rooms = await roomRes.json();
            
            const roomMap = {};
            rooms.forEach(r => roomMap[r.id] = r.room_number);

            const container = document.getElementById('students-list');
            container.innerHTML = '';

            students.forEach(student => {
                const roomDisplay = student.room_id ? `Room ${roomMap[student.room_id]}` : 'Unassigned';
                const el = document.createElement('div');
                el.className = 'list-item';
                el.innerHTML = `
                    <div class="student-info">
                        <h4>${student.name}</h4>
                        <div class="student-email">${student.email}</div>
                    </div>
                    <div class="badge">${roomDisplay}</div>
                `;
                container.appendChild(el);
            });
        } catch (error) {
            console.error('Error fetching students:', error);
        }
    }

    async function fetchBookings() {
        try {
            const res = await fetch(`${API_BASE}/bookings`);
            const bookings = await res.json();
            
            const container = document.getElementById('bookings-list');
            container.innerHTML = '';
            
            if(bookings.length === 0) {
                container.innerHTML = '<div style="color:var(--text-muted); padding: 1rem;">No pending bookings.</div>';
                return;
            }

            bookings.forEach(b => {
                const el = document.createElement('div');
                el.className = 'list-item';
                let statusBadgeColor = 'var(--text-muted)';
                if(b.status === 'Approved') statusBadgeColor = '#4cd137';
                if(b.status.includes('Rejected')) statusBadgeColor = '#e84118';
                
                el.innerHTML = `
                    <div class="student-info">
                        <h4>${b.student_name} <span style="font-weight:400; font-size:0.85rem; color:var(--text-muted);">(${b.student_email})</span></h4>
                        <div style="font-size: 0.9rem; margin-top:0.25rem;">Requested <strong style="color:white;">Room ${b.room_number}</strong></div>
                    </div>
                    <div style="display:flex; align-items:center; gap: 1rem;">
                        <span style="font-weight: bold; color: ${statusBadgeColor}">${b.status}</span>
                        ${b.status === 'Pending' ? `
                            <button onclick="updateBookingStatus(${b.id}, 'Approved')" style="padding: 0.5rem 1rem; border:none; background:#4cd137; color:white; border-radius:4px; cursor:pointer;">Approve</button>
                            <button onclick="updateBookingStatus(${b.id}, 'Rejected')" style="padding: 0.5rem 1rem; border:none; background:#e84118; color:white; border-radius:4px; cursor:pointer;">Reject</button>
                        ` : ''}
                    </div>
                `;
                container.appendChild(el);
            });
        } catch(err) {
            console.error(err);
        }
    }

    window.updateBookingStatus = async (bookingId, status) => {
        try {
            await fetch(`${API_BASE}/bookings/${bookingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            fetchBookings(); // Refresh
            fetchDashboardStats();
        } catch(err) {
            console.error(err);
        }
    };

    async function fetchNotices() {
        try {
            const res = await fetch(`${API_BASE}/notices`);
            const notices = await res.json();
            const container = document.getElementById('admin-notices-list');
            container.innerHTML = '';

            if(notices.length === 0) {
                container.innerHTML = '<div style="color:var(--text-muted); padding: 1rem;">No notices published yet.</div>';
                return;
            }

            notices.forEach(n => {
                const el = document.createElement('div');
                el.className = 'list-item';
                el.innerHTML = `
                    <div style="flex: 1;">
                        <h4 style="color: var(--accent);">${n.title}</h4>
                        <p style="font-size: 0.9rem; margin-top: 0.5rem; color: #eee; line-height: 1.4;">${n.content}</p>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">Published on ${n.created_at}</div>
                    </div>
                    <button onclick="deleteNotice(${n.id})" style="background: rgba(232, 65, 24, 0.1); color: #e84118; border: 1px solid #e84118; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Delete</button>
                `;
                container.appendChild(el);
            });
        } catch (error) {
            console.error('Error fetching notices:', error);
        }
    }

    window.deleteNotice = async (id) => {
        if(!confirm('Are you sure you want to delete this notice?')) return;
        try {
            await fetch(`${API_BASE}/notices/${id}`, { method: 'DELETE' });
            fetchNotices();
        } catch (error) {
            console.error(error);
        }
    };

    async function populateRoomSelect() {
        try {
            const res = await fetch(`${API_BASE}/rooms`);
            const rooms = await res.json();
            const select = document.getElementById('student-room');
            
            select.innerHTML = '<option value="">-- No Room Assigned --</option>';
            rooms.forEach(room => {
                if(room.current_occupancy < room.capacity) {
                    select.innerHTML += `<option value="${room.id}">Room ${room.room_number} (${room.capacity - room.current_occupancy} slots left)</option>`;
                }
            });
        } catch (error) {
            console.error('Error populating rooms:', error);
        }
    }

    // ==== Form Submissions ====
    document.getElementById('room-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const number = document.getElementById('room-number').value;
        const capacity = parseInt(document.getElementById('room-capacity').value);
        const price = parseInt(document.getElementById('room-price').value);

        try {
            const res = await fetch(`${API_BASE}/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_number: number, capacity, price })
            });

            if(!res.ok) {
                const data = await res.json();
                alert(data.detail || 'Error creating room');
                return;
            }

            document.getElementById('room-modal').classList.remove('active');
            e.target.reset();
            fetchRooms(); 
            fetchDashboardStats();
        } catch(err) {
            console.error(err);
        }
    });

    document.getElementById('student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('student-name').value;
        const email = document.getElementById('student-email').value;
        const roomIdVal = document.getElementById('student-room').value;
        
        const payload = { name, email };
        if(roomIdVal) payload.room_id = parseInt(roomIdVal);

        try {
            const res = await fetch(`${API_BASE}/students`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if(!res.ok) {
                const data = await res.json();
                alert(data.detail || 'Error registering student');
                return;
            }

            document.getElementById('student-modal').classList.remove('active');
            e.target.reset();
            fetchStudents();
            fetchDashboardStats();
        } catch(err) {
            console.error(err);
        }
    });

    document.getElementById('notice-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('notice-title').value;
        const content = document.getElementById('notice-content').value;

        try {
            const res = await fetch(`${API_BASE}/notices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });

            if(!res.ok) {
                alert('Failed to publish notice');
                return;
            }

            e.target.reset();
            fetchNotices();
        } catch (error) {
            console.error(error);
        }
    });

    // Initial Load
    fetchDashboardStats();
});
