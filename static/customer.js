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
            
            if(targetId === 'browse-view') fetchPublicRooms();
        });
    });

    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const loginView = document.getElementById('login-view');
    const portalView = document.getElementById('portal-view');

    // ==== Browse Rooms Logic ====
    async function fetchPublicRooms() {
        try {
            const res = await fetch('/api/rooms'); // Getting all rooms 
            const rooms = await res.json();
            
            const container = document.getElementById('public-rooms-list');
            container.innerHTML = '';
            
            rooms.forEach(room => {
                const available = room.capacity - room.current_occupancy;
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <div class="card-title">Room ${room.room_number}</div>
                    <div class="price-tag">$${room.price || 0} / month</div>
                    <div class="card-subtitle">Spots Available: ${available} / ${room.capacity}</div>
                    ${available > 0 
                        ? `<button class="action-btn" onclick="openBookingModal(${room.id}, '${room.room_number}')" style="width:100%; font-size:0.9rem;">Request Booking</button>` 
                        : `<button class="action-btn" disabled style="width:100%; font-size:0.9rem; background:#444; cursor:not-allowed;">Full</button>`}
                `;
                container.appendChild(card);
            });
        } catch (error) {
            console.error('Error fetching rooms:', error);
        }
    }

    // ==== Booking Modal ====
    const bookingModal = document.getElementById('booking-modal');
    window.openBookingModal = (roomId, roomNumber) => {
        document.getElementById('booking-room-id').value = roomId;
        document.getElementById('booking-room-label').innerText = roomNumber;
        bookingModal.classList.add('active');
    };

    document.getElementById('close-booking').addEventListener('click', () => bookingModal.classList.remove('active'));

    document.getElementById('booking-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const room_id = parseInt(document.getElementById('booking-room-id').value);
        const name = document.getElementById('booking-name').value;
        const email = document.getElementById('booking-email').value;

        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_name: name, student_email: email, room_id })
            });
            if(res.ok) {
                alert('Booking requested! You can check your status in the Portal shortly.');
                bookingModal.classList.remove('active');
                e.target.reset();
                fetchPublicRooms();
            } else {
                const data = await res.json();
                alert(data.detail || 'Booking failed');
            }
        } catch(err) {
            console.error(err);
        }
    });

    // ==== Portal Login Logic ====
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        loginError.style.display = 'none';

        try {
            const res = await fetch(`/api/student-portal/${encodeURIComponent(email)}`);
            if(!res.ok) {
                const data = await res.json();
                loginError.innerText = data.detail || 'Failed to authenticate.';
                loginError.style.display = 'block';
                return;
            }

            const data = await res.json();
            renderDashboard(data);
            
            navBtns.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active-view'));
            portalView.classList.add('active-view');
        } catch(err) {
            console.error(err);
            loginError.innerText = 'Server connection error.';
            loginError.style.display = 'block';
        }
    });

    function renderDashboard(data) {
        document.getElementById('portal-student-name').innerText = `Welcome back, ${data.name}`;
        document.getElementById('portal-student-email').innerText = data.email;

        const roomDisplay = document.getElementById('portal-room-display');
        if(data.room_number) {
            roomDisplay.innerHTML = `
                <div class="stat-number" style="font-size: 2.5rem; margin-bottom: 0.5rem;">Room ${data.room_number}</div>
                <div style="font-size: 0.9rem; color: var(--accent);">Maximum Capacity: ${data.capacity} Individuals</div>
            `;
        } else {
            roomDisplay.innerHTML = `<div style="font-style: italic; color: var(--text-muted);">You have not been assigned to a room yet. Please check back later.</div>`;
        }

        const roommatesList = document.getElementById('portal-roommates-list');
        roommatesList.innerHTML = '';
        if(data.roommates && data.roommates.length > 0) {
            data.roommates.forEach(rm => {
                roommatesList.innerHTML += `
                    <div class="list-item" style="padding: 0.75rem 1rem;">
                        <div class="student-info"><h4>${rm}</h4></div>
                    </div>
                `;
            });
        } else {
            roommatesList.innerHTML = `<div style="font-style: italic; color: var(--text-muted);">You currently have no roommates.</div>`;
        }
        
        const bookingsList = document.getElementById('portal-bookings-list');
        bookingsList.innerHTML = '';
        if(data.bookings && data.bookings.length > 0) {
            data.bookings.forEach(bk => {
                let statusColor = 'var(--text-muted)';
                if(bk.status === 'Approved') statusColor = '#4cd137';
                if(bk.status.includes('Rejected')) statusColor = '#e84118';
                
                bookingsList.innerHTML += `
                    <div class="list-item" style="padding: 0.75rem 1rem; display: flex; justify-content: space-between;">
                        <div class="student-info"><h4>Room ${bk.room_number}</h4></div>
                        <div style="color: ${statusColor}; font-weight: 600;">${bk.status}</div>
                    </div>
                `;
            });
        } else {
            bookingsList.innerHTML = `<div style="font-style: italic; color: var(--text-muted);">No booking requests found.</div>`;
        }
    }

    async function fetchNotices() {
        try {
            const res = await fetch('/api/notices');
            const notices = await res.json();
            
            const renderTarget = (containerId) => {
                const container = document.getElementById(containerId);
                if(!container) return;
                
                if(notices.length === 0) {
                    container.innerHTML = '';
                    return;
                }

                container.innerHTML = `
                    <div class="glass-panel" style="border-left: 4px solid var(--accent); padding: 1.5rem;">
                        <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span>📢</span> Hostel Announcements
                        </h3>
                        <div id="${containerId}-list"></div>
                    </div>
                `;
                
                const list = document.getElementById(`${containerId}-list`);
                notices.forEach(n => {
                    const el = document.createElement('div');
                    el.style.marginBottom = '1rem';
                    el.style.paddingBottom = '1rem';
                    el.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    el.innerHTML = `
                        <h4 style="color: var(--accent); margin-bottom: 0.25rem;">${n.title}</h4>
                        <p style="font-size: 0.9rem; line-height: 1.4; color: #eee;">${n.content}</p>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">Published ${n.created_at}</div>
                    `;
                    list.appendChild(el);
                });
            };

            renderTarget('public-notice-board');
            renderTarget('portal-notice-board');

        } catch (error) {
            console.error('Error fetching notices:', error);
        }
    }

    // Boot
    fetchPublicRooms();
    fetchNotices();
});
