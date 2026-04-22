// =================================================================
//                 EduTech Platform - Frontend Logic
//               (Vercel + Ngrok Deployment Ready)
// =================================================================

const { createApp } = Vue;
// 🚨 已经替换为你固定的 Ngrok 域名 (修复了多余的分号)
const BACKEND_URL = 'https://juliette-unattempted-tammara.ngrok-free.dev';

createApp({
    data() {
        return {
            // --- 视图与UI开关 ---
            currentView: 'home', 
            isCartOpen: false,
            showCheckoutModal: false,
            showAdminModal: false, 
            showAdminCreateModal: false, 

            // --- 表单与暂存数据 (修复了重复定义和丢失的变量) ---
            showItemModal: false,    
            selectedItem: null,      
            showEventModal: false,   
            selectedEvent: null,     
            isUploading: false,
            adminFormType: 'Book',
            adminFormData: { title: '', price: '', img: '', category: '', duration: '', extra: '' },
            loginForm: { email: '', password: '' },
            registerForm: { name: '', email: '', password: '' },
            checkoutForm: { address: '', country: '', shippingMethod: 'Ship' },
            newAdminForm: { name: '', email: '', password: '' }, 
            selectedNews: null,
            eventsData: [], 
            
            // --- 全局状态 ---
            currentUser: null, 
            cart: [],          

            // --- 数据库拉取的数据 ---
            books: [],
            coursesData: [],
            resourcesData: [],
            newsData: [],
            orders: [] 
        }
    },
    mounted() {
        this.fetchAllData();
    },
    computed: {
        cartTotal() {
            return this.cart.reduce((total, item) => total + Number(item.price), 0).toFixed(2);
        },
        calendarDays() {
            const days = [];
            const padding = [27, 28, 29, 30];
            padding.forEach(p => days.push({ dayNum: p, empty: true, events: [] }));
            
            for(let i = 1; i <= 31; i++) {
                const dateStr = `2026-05-${String(i).padStart(2, '0')}`;
                const dayEvents = this.eventsData.filter(e => {
                    return e.event_date && String(e.event_date).startsWith(dateStr);
                });
                days.push({ dayNum: i, empty: false, date: dateStr, events: dayEvents });
            }
            return days;
        },
        isAdmin() {
            return this.currentUser && this.currentUser.role === 'admin';
        }
    },
    methods: {
        // 🚨 所有 fetch 都加上了 ngrok-skip-browser-warning 通行证
        async fetchAllData() {
            const headers = { 'ngrok-skip-browser-warning': 'true' };
            try {
                const [booksRes, coursesRes, resourcesRes, newsRes, eventsRes] = await Promise.all([
                    fetch(`${BACKEND_URL}/api/books`, { headers }), 
                    fetch(`${BACKEND_URL}/api/courses`, { headers }),
                    fetch(`${BACKEND_URL}/api/resources`, { headers }), 
                    fetch(`${BACKEND_URL}/api/news`, { headers }),
                    fetch(`${BACKEND_URL}/api/events`, { headers }) 
                ]);
                this.books = await booksRes.json(); 
                this.coursesData = await coursesRes.json();
                this.resourcesData = await resourcesRes.json(); 
                this.newsData = await newsRes.json();
                this.eventsData = await eventsRes.json(); 
            } catch (error) { console.error("Fetch All Data Error:", error); }
        },
        async fetchOrders() {
            if (!this.isAdmin) return;
            try {
                const response = await fetch(`${BACKEND_URL}/api/orders`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                this.orders = await response.json();
            } catch (error) {
                console.error("Error fetching orders:", error);
            }
        },
        openEventModalForDate(dateStr) {
            this.adminFormType = 'Event';
            this.adminFormData = { 
                title: '', price: '', img: '', category: '', duration: '', extra: '', 
                event_date: dateStr, start_time: '09:00', end_time: '11:00' 
            };
            this.showAdminModal = true;
        },

        // --- 视图与交互 ---
        changeView(viewName) {
            this.currentView = viewName;
            this.isCartOpen = false; 
            window.scrollTo({ top: 0, behavior: 'smooth' }); 
        },
        toggleCart() { this.isCartOpen = !this.isCartOpen; },
        addToCart(book) { this.cart.push(book); this.isCartOpen = true; },
        removeFromCart(index) { this.cart.splice(index, 1); },
        readFullStory(newsItem) {
            this.selectedNews = newsItem;
            this.changeView('news-detail');
        },
        viewItemDetails(item) {
            this.selectedItem = item;
            this.showItemModal = true;
        },
        viewEventDetails(evt) {
            this.selectedEvent = evt;
            this.showEventModal = true;
        },

        // --- 本地图片上传 ---
        async handleImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
                alert('Invalid file format. Please upload PNG or JPEG only!');
                event.target.value = ''; 
                return;
            }

            this.isUploading = true;
            const formData = new FormData();
            formData.append('media', file);

            try {
                const response = await fetch(`${BACKEND_URL}/api/upload`, {
                    method: 'POST',
                    headers: { 'ngrok-skip-browser-warning': 'true' },
                    body: formData
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Upload failed');
                
                this.adminFormData.img = BACKEND_URL + data.url; 
                alert('Image uploaded successfully!');
            } catch (error) {
                console.error(error);
                alert(`Upload error: ${error.message}`);
                event.target.value = ''; 
            } finally {
                this.isUploading = false;
            }
        },

        // --- 认证流程 (Auth) ---
        async handleRegister() {
            if (!this.registerForm.email.trim().toLowerCase().endsWith('@gmail.com')) {
                alert('Registration Failed: Strictly only @gmail.com addresses are allowed.');
                return; 
            }
            try {
                const response = await fetch(`${BACKEND_URL}/api/register`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify(this.registerForm)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                
                alert(data.message);
                this.changeView('login');
                this.registerForm = { name: '', email: '', password: '' }; 
            } catch (error) {
                alert(`Registration Failed: ${error.message}`);
            }
        },
        async handleLogin() {
            try {
                const response = await fetch(`${BACKEND_URL}/api/login`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify(this.loginForm)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                this.currentUser = data; 
                this.loginForm = { email: '', password: '' }; 

                if (this.isAdmin) {
                    alert('Welcome, Admin! Redirecting to dashboard.');
                    this.fetchOrders(); 
                    this.changeView('admin-dashboard');
                } else {
                    alert(`Welcome back, ${this.currentUser.name}!`);
                    this.changeView('home');
                }
            } catch (error) {
                alert(`Login Failed: ${error.message}`);
            }
        },
        logout() {
            this.currentUser = null;
            this.cart = []; 
            this.changeView('home');
        },

        // --- 订单与结算 ---
        async processCheckout() {
            if (!this.currentUser) {
                alert("Please log in to complete your purchase!");
                this.changeView('login');
                return;
            }
            try {
                const response = await fetch(`${BACKEND_URL}/api/orders`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify({
                        userId: this.currentUser.id,
                        cart: this.cart,
                        shippingDetails: this.checkoutForm
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                
                alert('Payment successful! Your order has been placed.');
                this.cart = [];
                this.showCheckoutModal = false;
                this.isCartOpen = false;
            } catch(error) {
                alert(`Checkout Failed: ${error.message}`);
            }
        },

        // --- 管理员 CRUD 操作 ---
        adminAdd(type) {
            if(type === 'courses') type = 'Course';
            if(type === 'resources') type = 'Resource';
            
            this.adminFormType = type;
            this.adminFormData = { title: '', price: '', img: '', category: '', duration: '', extra: '' }; 
            this.showAdminModal = true;
        },
        async submitAdminForm() {
            if (!this.adminFormData.title) return alert("Title is required!");
            
            try {
                const response = await fetch(`${BACKEND_URL}/api/admin/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify({
                        type: this.adminFormType,
                        ...this.adminFormData
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                
                alert(data.message); 
                this.showAdminModal = false;
                this.fetchAllData();
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        },
        async adminDelete(type, id) {
            if(type === 'Item') {
                type = this.currentView === 'courses' ? 'Course' : 'Resource';
            }
            if(confirm(`WARNING: Are you sure you want to permanently delete this ${type} from the database?`)) {
                try {
                    const response = await fetch(`${BACKEND_URL}/api/admin/delete/${type}/${id}`, {
                        method: 'DELETE',
                        headers: { 'ngrok-skip-browser-warning': 'true' }
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message);
                    
                    alert(data.message);
                    this.fetchAllData();
                } catch (error) {
                    alert(`Error: ${error.message}`);
                }
            }
        },
        async createNewAdmin() {
            if (!this.newAdminForm.name || !this.newAdminForm.email || !this.newAdminForm.password) {
                return alert("Please fill all fields!");
            }
            try {
                const response = await fetch(`${BACKEND_URL}/api/admin/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify(this.newAdminForm)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                alert(data.message);
                this.showAdminCreateModal = false; 
                this.newAdminForm = { name: '', email: '', password: '' }; 
            } catch (error) {
                alert(`Failed: ${error.message}`);
            }
        }
    }
}).mount('#app');