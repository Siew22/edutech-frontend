// =================================================================
//                 EduTech Platform - Frontend Logic
// =================================================================

const { createApp } = Vue;
// 🚨 指向你固定的 Ngrok 域名
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
            showPaymentModal: false,
            showSearchModal: false,
            showItemModal: false,
            showEventModal: false,
            isUploading: false,

            // --- 搜索与过滤 ---
            searchQuery: '',
            searchResults: [],
            isSearching: false,
            noResultsFound: false,
            searchFilter: 'All', 
            courseLevelFilter: 'All',    // 🚨 新增：课程学位过滤器
            resourceLevelFilter: 'All',  // 🚨 新增：资源学位过滤器
            bookLevelFilter: 'All',      // 🚨 新增：书籍学位过滤器

            // --- 表单与暂存数据 ---
            selectedPaymentMethod: null, 
            adminFormType: 'Book',
            currentAdminTab: 'Basic', 
            adminFormData: { title: '', price: '', img: '', category: '', duration: '', extra: '', description: '', event_date: '', start_time: '', end_time: '', previewImg: null, targetLevel: 'All', video_url: '', tutorial_pdf_url: '', quiz_url: '', softcopy_pdf_url: '' , apply_url: '' },
            loginForm: { email: '', password: '' },
            registerForm: { name: '', email: '', password: '' },
            checkoutForm: { address: '', country: '', shippingMethod: 'Ship' },
            newAdminForm: { name: '', email: '', password: '' },
            quizScoreForm: {},
            selectedNews: null,
            selectedItem: null,
            selectedEvent: null,
            
            // --- 全局状态 ---
            currentMonth: 4, 
            currentYear: 2026,
            currentUser: null, 
            cart: [],          

            // --- 数据库拉取的数据 ---
            books: [],
            coursesData: [],
            resourcesData: [],
            newsData: [],
            eventsData: [], 
            messages:[],
            myLearningItems: [],
            quizSubmissions: [],
            orders: [],
            newForumMessage: '',
            pollingTimer: null,
        }
    },

    watch: {
        currentView(newVal) {
            if (newVal === 'forum') {
                this.fetchMessages();
                this.pollingTimer = setInterval(this.fetchMessages, 3000); 
            } else {
                if (this.pollingTimer) {
                    clearInterval(this.pollingTimer);
                    this.pollingTimer = null;
                }
            }
        }
    },
    mounted() {
        this.fetchAllData();
    },
    computed: {
        cartTotal() {
            return this.cart.reduce((total, item) => total + Number(item.price), 0).toFixed(2);
        },
        calendarHeaderTitle() {
            return new Date(this.currentYear, this.currentMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' });
        },
        calendarDays() {
            const days = [];
            let firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
            if (firstDay === 0) firstDay = 7; 
            const paddingCount = firstDay - 1;
            const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
            for (let i = 0; i < paddingCount; i++) {
                days.push({ dayNum: '', empty: true, events: [] });
            }
            for(let i = 1; i <= daysInMonth; i++) {
                const monthStr = String(this.currentMonth + 1).padStart(2, '0');
                const dayStr = String(i).padStart(2, '0');
                const dateStr = `${this.currentYear}-${monthStr}-${dayStr}`;
                const dayEvents = this.eventsData.filter(e => e.event_date && String(e.event_date).startsWith(dateStr));
                days.push({ dayNum: i, empty: false, date: dateStr, events: dayEvents });
            }
            const totalCells = days.length;
            const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
            for (let i = 0; i < remainingCells; i++) {
                days.push({ dayNum: '', empty: true, events: [] });
            }
            return days;
        },

        // --- 过滤后的动态列表 ---
        filteredCourses() {
            if (this.courseLevelFilter === 'All') {
                return this.coursesData;
            }
            return this.coursesData.filter(c => c.level === this.courseLevelFilter);
        },
        filteredResources() {
            if (this.resourceLevelFilter === 'All') {
                return this.resourcesData;
            }
            return this.resourcesData.filter(r => r.level === this.resourceLevelFilter);
        },
        filteredBooks() {
            if (this.bookLevelFilter === 'All') {
                return this.books;
            }
            return this.books.filter(b => b.level === this.bookLevelFilter);
        },
        filteredSearchResults() {
            if (this.searchFilter === 'All') {
                return this.searchResults;
            }
            return this.searchResults.filter(item => item.type === this.searchFilter);
        },
        
        isAdmin() {
            return this.currentUser && this.currentUser.role === 'admin';
        }
    },
    methods: {
        getSafeImageUrl(path) {
            if (!path) return 'https://via.placeholder.com/500x300.png?text=No+Image';
            if (path.startsWith('http') || path.startsWith('blob:')) return path;
            let cleanPath = path;
            if (!cleanPath.includes('uploads')) {
                cleanPath = '/uploads/' + cleanPath;
            }
            if (!cleanPath.startsWith('/')) {
                cleanPath = '/' + cleanPath;
            }
            return BACKEND_URL + cleanPath;
        },

        async fetchImageAsBlob(imagePath) {
            if (!imagePath) return 'https://via.placeholder.com/500x300.png?text=No+Image';
            // 如果是外部图片 (比如 unsplash) 或者已经是本地缓存了，直接放行
            if (imagePath.startsWith('http') && !imagePath.includes('ngrok-free.dev')) return imagePath; 
            
            let cleanPath = imagePath;
            if (!cleanPath.startsWith('http')) {
                if (!cleanPath.includes('uploads')) cleanPath = '/uploads/' + cleanPath;
                if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
                cleanPath = BACKEND_URL + cleanPath;
            }

            try {
                // 核心：用 fetch 带着 header 通行证去下载图片
                const res = await fetch(cleanPath, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                if (res.ok) {
                    const blob = await res.blob();
                    return URL.createObjectURL(blob); // 转换成本地浏览器绝对安全的链接
                }
            } catch (e) {
                console.error("Image load error:", e);
            }
            return cleanPath;
        },

        async updateOrderStatus(orderId, status) {
            try {
                const res = await fetch(`${BACKEND_URL}/api/admin/order-status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify({ orderId, newStatus: status })
                });
                const data = await res.json();
                alert(data.message);
                this.fetchOrders(); 
            } catch (e) { console.error(e); }
        },
        
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
                
                const rawBooks = await booksRes.json();
                const rawCourses = await coursesRes.json();
                const rawResources = await resourcesRes.json();
                const rawNews = await newsRes.json();
                const rawEvents = await eventsRes.json(); // 🚨 改成了 rawEvents

                // 🚨 魔法回归：数据拉下来后，立刻派特工去把所有图片下载转码！
                this.books = await Promise.all(rawBooks.map(async b => ({...b, cover_image_url: await this.fetchImageAsBlob(b.cover_image_url)})));
                this.coursesData = await Promise.all(rawCourses.map(async c => ({...c, img: await this.fetchImageAsBlob(c.img)})));
                this.resourcesData = await Promise.all(rawResources.map(async r => ({...r, img: await this.fetchImageAsBlob(r.img)})));
                this.newsData = await Promise.all(rawNews.map(async n => ({...n, img: await this.fetchImageAsBlob(n.img)})));
                // 🚨 漏掉的拼图补上了：日历事件的图片也必须派特工去下载！
                this.eventsData = await Promise.all(rawEvents.map(async e => ({...e, img: await this.fetchImageAsBlob(e.img)})));

            } catch (error) {
                console.error("Error fetching data:", error);
            }
        },

        async fetchMyLearning() {
            if (!this.currentUser) return;
            try {
                const res = await fetch(`${BACKEND_URL}/api/my-learning?userId=${this.currentUser.id}`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                const rawItems = await res.json();
                
                // 🚨 我的学习资料里的图片也要派特工去下载
                this.myLearningItems = await Promise.all(rawItems.map(async item => {
                    const imgKey = item.cover_image_url ? 'cover_image_url' : 'img';
                    return { ...item,[imgKey]: await this.fetchImageAsBlob(item[imgKey]) };
                }));
            } catch (error) { 
                console.error("Failed to fetch my learning items:", error); 
            }
        },
        
        async submitQuizScore(item) {
            const score = this.quizScoreForm[item.id];
            if (!score || !score.trim()) return alert("Please enter your score!");
            try {
                const response = await fetch(`${BACKEND_URL}/api/quiz/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify({ userId: this.currentUser.id, userName: this.currentUser.name, itemId: item.id, itemTitle: item.title, itemType: item.type, score: score })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        alert('Your score has been submitted!');
        this.quizScoreForm[item.id] = '';
        this.fetchQuizSubmissions(); // Admin实时刷新
        } catch (error) { alert(`Submission failed: ${error.message}`); }
    },
    
    async fetchQuizSubmissions() {
        if (!this.isAdmin) return;
        try {
            const res = await fetch(`${BACKEND_URL}/api/quiz/submissions`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
            this.quizSubmissions = await res.json();
        } catch (error) { console.error("Failed to fetch submissions:", error); }
    },

        async handleSearch() {
            if (!this.searchQuery.trim()) return;

            this.isSearching = true;
            this.noResultsFound = false;
            this.searchResults = [];
            this.searchFilter = 'All';

            try {
            const response = await fetch(`${BACKEND_URL}/api/search?q=${this.searchQuery}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            const rawData = await response.json();
            
            // 🚨 魔法补全：让特工把搜索结果里的每一张图片都去后端下载并转码！
            this.searchResults = await Promise.all(rawData.map(async item => {
                return {
                    ...item,
                    img: await this.fetchImageAsBlob(item.img)
                };
            }));
            
            if (rawData.length === 0) {
                this.noResultsFound = true;
            }
            } catch (error) {
                console.error("Search failed:", error);
                this.noResultsFound = true;
            } finally {
                this.isSearching = false;
            }
        },



        setSearchFilter(filter) {
            this.searchFilter = filter;
        },

        goToResult(item) {
            this.showSearchModal = false;
            if (item.type === 'Book') this.changeView('bookstore');
            else if (item.type === 'Course') this.changeView('courses');
            else if (item.type === 'Resource') this.changeView('resources');
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

        changeView(viewName) {
            this.currentView = viewName;
            this.isCartOpen = false; 
            window.scrollTo({ top: 0, behavior: 'smooth' }); 
            
            // 🚨 关键：每次进入“我的学习”页面都重新拉取数据
            if (viewName === 'my-learning') {
                this.fetchMyLearning();
            }
        },

        prevMonth() {
            if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; } 
            else { this.currentMonth--; }
        },
        nextMonth() {
            if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; } 
            else { this.currentMonth++; }
        },
        toggleCart() { this.isCartOpen = !this.isCartOpen; },
        
        addToCart(item, type) {
            const existingItem = this.cart.find(cartItem => cartItem.id === item.id && cartItem.type === type);
            if (existingItem) return alert(`${item.title} is already in your cart!`);
            
            this.cart.push({ ...item, type: type });
            this.isCartOpen = true; 
        },
        removeFromCart(index) { this.cart.splice(index, 1); },
        
        readFullStory(newsItem) {
            this.selectedNews = newsItem;
            this.changeView('news-detail');
        },

        async fetchMessages() {
            try {
                const res = await fetch(`${BACKEND_URL}/api/messages`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                this.messages = await res.json();
                this.scrollToBottom();
            } catch (e) { console.error(e); }
        },
        async sendForumMessage() {
            if (!this.currentUser) { alert("Please log in to chat!"); this.changeView('login'); return; }
            if (!this.newForumMessage.trim()) return;

            try {
                await fetch(`${BACKEND_URL}/api/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify({ userName: this.currentUser.name, message: this.newForumMessage.trim() })
                });
                this.newForumMessage = '';
                this.fetchMessages();
            } catch (e) { console.error(e); }
        },
        scrollToBottom() {
            setTimeout(() => {
                const box = document.getElementById('chat-box');
                if(box) box.scrollTop = box.scrollHeight;
            }, 100);
        },

        viewItemDetails(item) {
            this.selectedItem = item;
            this.showItemModal = true;
        },

        viewEventDetails(evt) {
            this.selectedEvent = evt;
            this.showEventModal = true;
        },

        async handleFileUpload(event, fieldToUpdate) {
            const file = event.target.files[0];
            if (!file) return;

            if (fieldToUpdate === 'img') {
                this.adminFormData.previewImg = URL.createObjectURL(file);
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
                if (!response.ok) throw new Error(data.message);
                
                this.adminFormData[fieldToUpdate] = data.path; 
                if (fieldToUpdate !== 'img') alert(`${fieldToUpdate} uploaded successfully!`);
            } catch (error) {
                alert(`Upload error: ${error.message}`);
            } finally {
                this.isUploading = false;
            }
        },
        
        handlePayment(method) {
            this.selectedPaymentMethod = method;
            this.showCheckoutModal = false;
            this.showPaymentModal = true;
        },

        async confirmPayment() {
            alert(`Payment confirmation received for ${this.selectedPaymentMethod}. Finalizing order...`);
            await this.processCheckout(this.selectedPaymentMethod);
        },

        async processCheckout(paymentMethodUsed) {
            if (!this.currentUser) { alert("Please log in to complete your purchase!"); this.changeView('login'); return; }
            
            try {
                const response = await fetch(`${BACKEND_URL}/api/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify({
                        userId: this.currentUser.id,
                        cart: this.cart,
                        shippingDetails: this.checkoutForm,
                        paymentMethod: paymentMethodUsed
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                
                alert('Order placed successfully! Admin will verify your payment.');
                this.cart = [];
                this.showPaymentModal = false;
                this.isCartOpen = false;
                this.fetchOrders();
            } catch(error) {
                alert(`Order Failed: ${error.message}`);
            }
        },

        async handleRegister() {
            const email = this.registerForm.email.trim().toLowerCase();
            if (!email.endsWith('@gmail.com') && !email.endsWith('@edutech.com')) {
                alert('Registration Failed: Only @gmail.com (Student) or @edutech.com (Admin) are allowed.');
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
            const email = this.loginForm.email.trim().toLowerCase();
            if (!email.endsWith('@gmail.com') && !email.endsWith('@edutech.com')) {
                return alert('Login Failed: Invalid domain. Only @gmail.com or @edutech.com exist in our system.');
            }
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
                    this.fetchQuizSubmissions(); // 🚨 添加这行
                    this.changeView('admin-dashboard');
                } else {
                    alert(`Welcome back, ${this.currentUser.name}!`);
                    this.fetchMyLearning(); // 🚨 添加这行
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

        adminAdd(type) {
            if(type === 'courses') type = 'Course';
            if(type === 'resources') type = 'Resource';
            
            this.adminFormType = type;
            this.currentAdminTab = 'Basic';
            this.adminFormData = { title: '', price: '', img: '', category: '', duration: '', extra: '', description: '', event_date: '', start_time: '', end_time: '', previewImg: null, targetLevel: 'All' }; 
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
                await this.fetchAllData(); 
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        },
        async adminDelete(type, id) {
            if(type === 'Item') {
                type = this.currentView === 'courses' ? 'Course' : 'Resource';
            }
            if(confirm(`WARNING: Are you sure you want to permanently delete this ${type}?`)) {
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
            if (!this.newAdminForm.name || !this.newAdminForm.email || !this.newAdminForm.password) return alert("Please fill all fields!");
            
            const adminEmail = this.newAdminForm.email.trim().toLowerCase();
            if (!adminEmail.endsWith('@edutech.com')) return alert("Security Alert: Administrator emails MUST end with @edutech.com!");
            
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
        },
        // ✅ 把 openEventModalForDate 方法改成这样：
        openEventModalForDate(dateStr) {
            this.adminFormType = 'Event';
            this.adminFormData = { 
                title: '', price: '', img: '', extra: '', 
                event_date: dateStr, start_time: '09:00', end_time: '11:00', apply_url: '', previewImg: null 
            };
            this.showAdminModal = true;
        }
    }
}).mount('#app');