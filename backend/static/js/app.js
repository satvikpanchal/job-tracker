// Job Tracker Application JavaScript
class JobTracker {
    constructor() {
        this.allJobs = [];
        this.filteredJobs = [];
        this.selectedJobs = new Set();
        this.currentPage = 1;
        this.pageSize = 10;
        this.isUpdating = false; // Track if bulk update is in progress
        this.lastSyncTime = localStorage.getItem('lastSyncTime');
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupTheme();
        this.loadJobs();
        this.updateLastSyncDisplay();
        this.setupResponsive();
    }
    
    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        themeToggle?.addEventListener('click', () => this.toggleTheme());
        
        // Sync button
        const syncBtn = document.getElementById('syncBtn');
        syncBtn?.addEventListener('click', () => this.syncEmails());
        
        // Search and filters
        const searchInput = document.getElementById('searchInput');
        searchInput?.addEventListener('input', this.debounce((e) => this.handleSearch(e.target.value), 250));
        
        const filterBtn = document.getElementById('filterBtn');
        const filterMenu = document.getElementById('filterMenu');
        filterBtn?.addEventListener('click', () => this.toggleDropdown(filterMenu));
        
        // Filter checkboxes
        const filterCheckboxes = document.querySelectorAll('#filterMenu input[type="checkbox"]');
        filterCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.handleFilter());
        });
        
        // Pagination
        document.getElementById('pageSize')?.addEventListener('change', (e) => {
            this.pageSize = parseInt(e.target.value);
            this.currentPage = 1;
            this.renderTable();
        });
        
        document.getElementById('prevPage')?.addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage')?.addEventListener('click', () => this.nextPage());
        
        // Select all checkbox
        document.getElementById('selectAll')?.addEventListener('change', (e) => this.handleSelectAll(e.target.checked));
        
        // Job checkboxes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('job-checkbox')) {
                this.handleJobSelect(e.target);
            }
        });
        
        // Update/Delete buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.update-btn')) {
                const btn = e.target.closest('.update-btn');
                this.showUpdateModal(btn.dataset);
            } else if (e.target.closest('.delete-btn')) {
                const btn = e.target.closest('.delete-btn');
                this.showDeleteConfirm(btn.dataset.jobId, btn.dataset.company);
            }
        });
        
        // Notes cell clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.notes-cell')) {
                const cell = e.target.closest('.notes-cell');
                const company = cell.dataset.company;
                const role = cell.dataset.role;
                const note = cell.dataset.note;
                this.showNotesModal(company, role, note);
            }
        });
        
        // Modal event listeners
        this.setupModalListeners();
        
        // Bulk actions
        document.getElementById('bulkUpdateBtn')?.addEventListener('click', () => this.showBulkUpdateModal());
        document.getElementById('bulkDeleteBtn')?.addEventListener('click', () => this.showBulkDeleteConfirm());
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-dropdown')) {
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.remove('show');
                });
            }
        });
    }
    
    setupModalListeners() {
        // Update form submission
        document.getElementById('updateForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUpdateSubmit();
        });
        
        // Close modal buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        
        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        });
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }
    
    setupTheme() {
        // Check for saved theme preference or default to system preference
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (systemPrefersDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        
        this.updateThemeIcon();
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                this.updateThemeIcon();
            }
        });
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon();
    }
    
    updateThemeIcon() {
        const themeIcon = document.getElementById('themeIcon');
        const currentTheme = document.documentElement.getAttribute('data-theme');
        
        if (themeIcon) {
            themeIcon.className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
    
    setupResponsive() {
        const updateResponsive = () => {
            const isMobile = window.innerWidth <= 768;
            const tableContainer = document.querySelector('.table-container');
            const mobileCards = document.getElementById('mobileCards');
            
            if (tableContainer && mobileCards) {
                if (isMobile) {
                    tableContainer.style.display = 'none';
                    mobileCards.style.display = 'grid';
                } else {
                    tableContainer.style.display = 'block';
                    mobileCards.style.display = 'none';
                }
            }
        };
        
        updateResponsive();
        window.addEventListener('resize', this.debounce(updateResponsive, 250));
    }
    
    loadJobs() {
        console.log("📥 Loading jobs from HTML...");
        // Extract jobs from the table
        const rows = document.querySelectorAll('#jobsTableBody tr');
        console.log("📋 Found table rows:", rows.length);
        
        this.allJobs = Array.from(rows).map((row, index) => {
            const jobData = {
                id: row.dataset.jobId,
                company: row.querySelector('.company-name')?.textContent || '',
                role: row.querySelector('.role-cell')?.textContent || '',
                status: row.dataset.status,
                appliedDate: row.querySelector('.date-cell')?.textContent || '',
                lastUpdate: row.querySelectorAll('.date-cell')[1]?.textContent || ''
            };
            console.log(`📋 Job ${index + 1}:`, jobData);
            return jobData;
        });
        
        console.log("📊 Total jobs loaded:", this.allJobs.length);
        console.log("🆔 Job IDs:", this.allJobs.map(job => job.id));
        
        this.filteredJobs = [...this.allJobs];
        this.renderTable();
    }
    
    handleSearch(query) {
        const searchTerm = query.toLowerCase().trim();
        
        if (!searchTerm) {
            this.filteredJobs = [...this.allJobs];
        } else {
            this.filteredJobs = this.allJobs.filter(job =>
                job.company.toLowerCase().includes(searchTerm) ||
                job.role.toLowerCase().includes(searchTerm)
            );
        }
        
        this.currentPage = 1;
        this.renderTable();
    }
    
    handleFilter() {
        const filterCheckboxes = document.querySelectorAll('#filterMenu input[type="checkbox"]:checked');
        const selectedStatuses = Array.from(filterCheckboxes).map(cb => cb.value);
        
        if (selectedStatuses.includes('all') || selectedStatuses.length === 0) {
            this.filteredJobs = [...this.allJobs];
        } else {
            this.filteredJobs = this.allJobs.filter(job => selectedStatuses.includes(job.status));
        }
        
        // Apply current search if exists
        const searchInput = document.getElementById('searchInput');
        if (searchInput?.value) {
            this.handleSearch(searchInput.value);
        } else {
            this.currentPage = 1;
            this.renderTable();
        }
    }
    
    renderTable() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageJobs = this.filteredJobs.slice(startIndex, endIndex);
        
        // Update table visibility
        const tableBody = document.getElementById('jobsTableBody');
        const rows = tableBody?.querySelectorAll('tr');
        
        if (rows) {
            rows.forEach((row, index) => {
                const jobId = row.dataset.jobId;
                const shouldShow = pageJobs.some(job => job.id === jobId);
                row.style.display = shouldShow ? '' : 'none';
            });
        }
        
        // Update mobile cards
        const mobileCards = document.querySelectorAll('.job-card');
        mobileCards.forEach(card => {
            const jobId = card.dataset.jobId;
            const shouldShow = pageJobs.some(job => job.id === jobId);
            card.style.display = shouldShow ? '' : 'none';
        });
        
        this.updatePaginationInfo();
        this.updatePaginationButtons();
    }
    
    updatePaginationInfo() {
        const totalJobs = this.filteredJobs.length;
        const startIndex = (this.currentPage - 1) * this.pageSize + 1;
        const endIndex = Math.min(this.currentPage * this.pageSize, totalJobs);
        
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo) {
            if (totalJobs === 0) {
                paginationInfo.textContent = 'No jobs found';
            } else {
                paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${totalJobs} jobs`;
            }
        }
    }
    
    updatePaginationButtons() {
        const totalPages = Math.ceil(this.filteredJobs.length / this.pageSize);
        
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const pageNumbers = document.getElementById('pageNumbers');
        
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
        if (pageNumbers) pageNumbers.textContent = `${this.currentPage} of ${totalPages || 1}`;
    }
    
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTable();
        }
    }
    
    nextPage() {
        const totalPages = Math.ceil(this.filteredJobs.length / this.pageSize);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderTable();
        }
    }
    
    handleSelectAll(checked) {
        const visibleJobIds = this.getVisibleJobIds();
        console.log("🔍 Select all - visible job IDs:", visibleJobIds);
        
        if (checked) {
            visibleJobIds.forEach(id => this.selectedJobs.add(id));
        } else {
            visibleJobIds.forEach(id => this.selectedJobs.delete(id));
        }
        
        console.log("📋 Selected jobs after select all:", Array.from(this.selectedJobs));
        this.updateJobCheckboxes();
        this.updateBulkActions();
    }
    
    handleJobSelect(checkbox) {
        const jobId = checkbox.value;
        console.log("🔍 Individual job selection:", jobId, checkbox.checked);
        
        if (checkbox.checked) {
            this.selectedJobs.add(jobId);
        } else {
            this.selectedJobs.delete(jobId);
        }
        
        console.log("📋 Selected jobs after individual selection:", Array.from(this.selectedJobs));
        this.updateSelectAllState();
        this.updateBulkActions();
    }
    
    getVisibleJobIds() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const visibleJobs = this.filteredJobs.slice(startIndex, endIndex);
        const ids = visibleJobs.map(job => job.id);
        console.log("👁️ Visible jobs:", visibleJobs.map(job => ({id: job.id, company: job.company, role: job.role})));
        return ids;
    }
    
    updateJobCheckboxes() {
        const checkboxes = document.querySelectorAll('.job-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.selectedJobs.has(checkbox.value);
        });
    }
    
    updateSelectAllState() {
        const selectAllCheckbox = document.getElementById('selectAll');
        const visibleJobIds = this.getVisibleJobIds();
        
        if (selectAllCheckbox) {
            const allVisible = visibleJobIds.every(id => this.selectedJobs.has(id));
            const someVisible = visibleJobIds.some(id => this.selectedJobs.has(id));
            
            selectAllCheckbox.checked = allVisible;
            selectAllCheckbox.indeterminate = someVisible && !allVisible;
        }
    }
    
    updateBulkActions() {
        const bulkActions = document.getElementById('bulkActions');
        const selectedCount = document.getElementById('selectedCount');
        
        if (bulkActions && selectedCount) {
            const count = this.selectedJobs.size;
            
            if (count > 0) {
                bulkActions.style.display = 'block';
                selectedCount.textContent = `${count} selected`;
            } else {
                bulkActions.style.display = 'none';
            }
        }
    }
    
    showUpdateModal(jobData) {
        const modal = document.getElementById('updateModal');
        
        // Update modal header for individual job
        const titleGroup = modal.querySelector('.modal-title-group');
        titleGroup.innerHTML = `
            <h3 class="modal-company-name">${jobData.company}</h3>
            <p class="modal-position-name">${jobData.role}</p>
        `;
        
        // Create form for individual job update
        const form = modal.querySelector('#updateForm');
        form.innerHTML = `
            <input type="hidden" id="updateJobId" value="${jobData.jobId}">
            
            <div class="form-group">
                <label for="updateStatus">Status *</label>
                <div class="status-options">
                    <label class="status-option">
                        <input type="radio" name="status" value="applied" ${jobData.status === 'applied' ? 'checked' : ''}>
                        <span class="status-badge status-applied">
                            <i class="fas fa-paper-plane"></i>
                            Applied
                        </span>
                    </label>
                    <label class="status-option">
                        <input type="radio" name="status" value="interview" ${jobData.status === 'interview' ? 'checked' : ''}>
                        <span class="status-badge status-interview">
                            <i class="fas fa-calendar-alt"></i>
                            Interview
                        </span>
                    </label>
                    <label class="status-option">
                        <input type="radio" name="status" value="offer" ${jobData.status === 'offer' ? 'checked' : ''}>
                        <span class="status-badge status-offer">
                            <i class="fas fa-trophy"></i>
                            Offer
                        </span>
                    </label>
                    <label class="status-option">
                        <input type="radio" name="status" value="rejected" ${jobData.status === 'rejected' ? 'checked' : ''}>
                        <span class="status-badge status-rejected">
                            <i class="fas fa-times-circle"></i>
                            Rejected
                        </span>
                    </label>
                </div>
            </div>
            
            <div class="form-group">
                <label for="updateNote">Note (optional)</label>
                <textarea id="updateNote" name="note" placeholder="Add any additional notes..."></textarea>
            </div>
            
            <div class="form-group">
                <label for="updateDate">Update Date</label>
                <input type="date" id="updateDate" name="date" value="${new Date().toISOString().split('T')[0]}">
            </div>
            
            <div class="modal-actions">
                <button type="button" class="btn btn-outline modal-close">Cancel</button>
                <button type="submit" class="btn btn-primary">Update Job</button>
            </div>
        `;
        
        // Set up form submission for individual update
        form.onsubmit = (e) => {
            e.preventDefault();
            this.handleUpdateSubmit();
        };
        
        this.showModal(modal);
    }
    
    async handleUpdateSubmit() {
        const form = document.getElementById('updateForm');
        const formData = new FormData(form);
        const jobId = document.getElementById('updateJobId').value;
        
        try {
            const response = await fetch(`/update/${jobId}`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('success', 'Job Updated', result.message);
                this.closeModal();
                // Reload page to update table
                setTimeout(() => window.location.reload(), 1000);
            } else {
                this.showToast('error', 'Update Failed', result.message || 'An error occurred');
            }
        } catch (error) {
            this.showToast('error', 'Update Failed', 'Network error occurred');
        }
    }
    
    showDeleteConfirm(jobId, company) {
        if (confirm(`Are you sure you want to delete the job application for ${company}?`)) {
            this.deleteJob(jobId);
        }
    }
    
    async deleteJob(jobId) {
        try {
            const response = await fetch(`/delete/${jobId}`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('success', 'Job Deleted', result.message);
                // Remove from selected jobs
                this.selectedJobs.delete(jobId);
                // Reload page to update table
                setTimeout(() => window.location.reload(), 1000);
            } else {
                this.showToast('error', 'Delete Failed', result.message || 'An error occurred');
            }
        } catch (error) {
            this.showToast('error', 'Delete Failed', 'Network error occurred');
        }
    }
    
    showBulkUpdateModal() {
        const selectedCount = this.selectedJobs.size;
        if (selectedCount === 0) {
            this.showToast('info', 'No Selection', 'Please select jobs to update');
            return;
        }
        
        // Create bulk update modal content
        const modal = document.getElementById('updateModal');
        const modalContent = modal.querySelector('.modal-content');
        
        // Update modal header for bulk update
        const titleGroup = modal.querySelector('.modal-title-group');
        titleGroup.innerHTML = `
            <h3 class="modal-company-name">Bulk Update</h3>
            <p class="modal-position-name">${selectedCount} job${selectedCount > 1 ? 's' : ''} selected</p>
        `;
        
        // Update form for bulk update - with notes
        const form = modal.querySelector('#updateForm');
        form.innerHTML = `
            <div class="form-group">
                <label for="updateStatus">Status *</label>
                <div class="status-options">
                    <label class="status-option">
                        <input type="radio" name="status" value="applied">
                        <span class="status-badge status-applied">
                            <i class="fas fa-paper-plane"></i>
                            Applied
                        </span>
                    </label>
                    <label class="status-option">
                        <input type="radio" name="status" value="interview">
                        <span class="status-badge status-interview">
                            <i class="fas fa-calendar-alt"></i>
                            Interview
                        </span>
                    </label>
                    <label class="status-option">
                        <input type="radio" name="status" value="offer">
                        <span class="status-badge status-offer">
                            <i class="fas fa-trophy"></i>
                            Offer
                        </span>
                    </label>
                    <label class="status-option">
                        <input type="radio" name="status" value="rejected">
                        <span class="status-badge status-rejected">
                            <i class="fas fa-times-circle"></i>
                            Rejected
                        </span>
                    </label>
                </div>
            </div>
            
            <div class="form-group">
                <label for="updateRole">Position Name (optional)</label>
                <input type="text" id="updateRole" name="role" placeholder="Update position name for all selected jobs...">
            </div>
            
            <div class="form-group">
                <label for="updateNote">Note (optional)</label>
                <textarea id="updateNote" name="note" placeholder="Add any additional notes for all selected jobs..."></textarea>
            </div>
            
            <div class="form-group">
                <label for="updateDate">Update Date</label>
                <input type="date" id="updateDate" name="date" value="${new Date().toISOString().split('T')[0]}">
            </div>
            
            <div class="modal-actions">
                <button type="button" class="btn btn-outline modal-close">Cancel</button>
                <button type="button" class="btn btn-primary" id="bulkUpdateSubmit">Update ${selectedCount} Job${selectedCount > 1 ? 's' : ''}</button>
            </div>
        `;
        
        // Set up button click for bulk update (not form submission)
        const bulkUpdateBtn = form.querySelector('#bulkUpdateSubmit');
        bulkUpdateBtn.onclick = () => {
            console.log("🔄 Bulk update button clicked!");
            this.handleBulkUpdateSubmit();
        };
        
        this.showModal(modal);
    }
    
    async handleBulkUpdateSubmit() {
        console.log("🔄 Starting bulk update...");
        
        // Prevent multiple submissions
        if (this.isUpdating) {
            console.log("⏳ Update already in progress, ignoring...");
            return;
        }
        
        this.isUpdating = true;
        
        const form = document.getElementById('updateForm');
        const formData = new FormData(form);
        const status = formData.get('status');
        const role = formData.get('role');
        const note = formData.get('note');
        const date = formData.get('date');
        
        console.log("📋 Form data:", { status, role, note, date });
        
        if (!status) {
            this.showToast('error', 'Status Required', 'Please select a status');
            this.isUpdating = false;
            return;
        }
        
        const jobIds = Array.from(this.selectedJobs);
        console.log("🎯 Selected job IDs:", jobIds);
        console.log("📊 Number of selected jobs:", jobIds.length);
        
        // Filter out any invalid job IDs
        const validJobIds = jobIds.filter(id => id && id !== 'bulk' && id !== '');
        console.log("✅ Valid job IDs:", validJobIds);
        
        if (validJobIds.length === 0) {
            this.showToast('error', 'No Valid Jobs', 'No valid jobs selected for update');
            this.isUpdating = false;
            return;
        }
        
        // Prevent duplicate requests by disabling the button
        const submitBtn = document.getElementById('bulkUpdateSubmit');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Updating...';
        }
        
        try {
            const promises = validJobIds.map(jobId => {
                console.log(`📤 Sending update request for job ${jobId}`);
                const data = new FormData();
                data.append('status', status);
                if (role && role.trim()) data.append('role', role.trim());
                if (note) data.append('note', note); // Add note for bulk update
                if (date) data.append('date', date);
                
                return fetch(`/update/${jobId}`, {
                    method: 'POST',
                    body: data
                });
            });
            
            console.log("⏳ Waiting for all update responses...");
            const responses = await Promise.all(promises);
            console.log("📥 Received all responses:", responses.length);
            
            const results = await Promise.all(responses.map(async (r, index) => {
                const result = await r.json();
                console.log(`📋 Response ${index + 1} for job ${validJobIds[index]}:`, result);
                return result;
            }));
            
            const successCount = results.filter(r => r.success).length;
            console.log(`✅ Success count: ${successCount}/${validJobIds.length}`);
            
            if (successCount === validJobIds.length) {
                this.showToast('success', 'Bulk Update Complete', `${successCount} jobs updated successfully`);
                this.selectedJobs.clear();
                this.closeModal();
                setTimeout(() => window.location.reload(), 1000);
            } else {
                this.showToast('warning', 'Partial Update', `${successCount} of ${validJobIds.length} jobs updated successfully`);
            }
        } catch (error) {
            console.error("❌ Bulk update error:", error);
            this.showToast('error', 'Bulk Update Failed', 'Network error occurred');
        } finally {
            // Re-enable the button and reset state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = `Update ${validJobIds.length} Job${validJobIds.length > 1 ? 's' : ''}`;
            }
            this.isUpdating = false;
        }
    }
    
    showBulkDeleteConfirm() {
        const count = this.selectedJobs.size;
        if (confirm(`Are you sure you want to delete ${count} job application${count > 1 ? 's' : ''}?`)) {
            this.bulkDeleteJobs();
        }
    }
    
    async bulkDeleteJobs() {
        const promises = Array.from(this.selectedJobs).map(jobId => 
            fetch(`/delete/${jobId}`, { method: 'POST' })
        );
        
        try {
            await Promise.all(promises);
            this.showToast('success', 'Jobs Deleted', `${this.selectedJobs.size} jobs deleted successfully`);
            this.selectedJobs.clear();
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            this.showToast('error', 'Bulk Delete Failed', 'Some jobs could not be deleted');
        }
    }
    
    async syncEmails() {
        console.log("🔄 Starting email sync...");
        const syncBtn = document.getElementById('syncBtn');
        const syncIcon = document.getElementById('syncIcon');
        const progressModal = document.getElementById('progressModal');
        const progressFill = document.getElementById('progressFill');
        const progressMessage = document.getElementById('progressMessage');
        
        // Disable sync button and show loading
        syncBtn.disabled = true;
        syncIcon.classList.add('animate-spin');
        console.log("✅ Sync button disabled and spinner started");
        
        // Show progress modal
        this.showModal(progressModal);
        console.log("✅ Progress modal shown");
        
        try {
            console.log("📡 Creating EventSource connection...");
            const eventSource = new EventSource('/sync-stream');
            
            eventSource.onopen = () => {
                console.log("✅ EventSource connection opened");
            };
            
            eventSource.onerror = (error) => {
                console.error("❌ EventSource error:", error);
                this.showToast('error', 'Sync Failed', 'Connection error occurred');
                this.closeModal();
                syncBtn.disabled = false;
                syncIcon.classList.remove('animate-spin');
            };
            
            eventSource.onmessage = (event) => {
                console.log("📨 Received SSE message:", event.data);
                const data = JSON.parse(event.data);
                
                switch (data.status) {
                    case 'starting':
                        console.log("🚀 Sync starting...");
                        progressFill.style.width = '10%';
                        progressMessage.textContent = data.message;
                        break;
                    case 'processing':
                        console.log("⚙️ Processing emails...");
                        progressFill.style.width = '70%';
                        progressMessage.textContent = data.message;
                        break;
                    case 'complete':
                        console.log("✅ Sync complete!");
                        progressFill.style.width = '100%';
                        progressMessage.textContent = data.message;
                        
                        // Update last sync time
                        this.updateLastSyncDisplay();
                        
                        // Close modal and re-enable button
                        setTimeout(() => {
                            this.closeModal();
                            syncBtn.disabled = false;
                            syncIcon.classList.remove('animate-spin');
                            console.log("✅ Sync UI reset complete");
                            
                            // Reload page to show new jobs
                            window.location.reload();
                        }, 2000);
                        
                        eventSource.close();
                        break;
                }
            };
            
        } catch (error) {
            console.error("❌ Sync error:", error);
            this.showToast('error', 'Sync Failed', 'An error occurred during sync');
            this.closeModal();
            syncBtn.disabled = false;
            syncIcon.classList.remove('animate-spin');
        }
    }
    
    updateLastSyncDisplay() {
        const lastSyncElement = document.querySelector('.last-sync .sync-text');
        
        if (lastSyncElement && this.lastSyncTime) {
            const syncDate = new Date(this.lastSyncTime);
            const now = new Date();
            const diffMs = now - syncDate;
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            let timeAgo;
            if (diffMins < 1) {
                timeAgo = 'Just now';
            } else if (diffMins < 60) {
                timeAgo = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
            } else if (diffHours < 24) {
                timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else {
                timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            }
            
            lastSyncElement.textContent = `Last synced: ${timeAgo}`;
        }
    }
    
    showModal(modal) {
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
            
            // Focus first focusable element
            const focusable = modal.querySelector('input, button, textarea, select');
            if (focusable) focusable.focus();
        }
    }
    
    closeModal() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.remove('show');
        });
        document.body.style.overflow = '';
        
        // Reset forms
        const forms = document.querySelectorAll('.modal form');
        forms.forEach(form => form.reset());
    }
    
    toggleDropdown(dropdown) {
        const isOpen = dropdown.classList.contains('show');
        
        // Close all dropdowns
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
        
        // Toggle this dropdown
        if (!isOpen) {
            dropdown.classList.add('show');
        }
    }
    
    showToast(type, title, message) {
        const toastContainer = document.getElementById('toastContainer') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="btn btn-ghost toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toastContainer.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
    
    showNotesModal(company, role, note) {
        const modal = document.getElementById('notesModal');
        const companyEl = document.getElementById('notesModalCompany');
        const roleEl = document.getElementById('notesModalRole');
        const noteEl = document.getElementById('notesModalNote');
        
        companyEl.textContent = company;
        roleEl.textContent = role;
        noteEl.textContent = note || 'No notes available for this job.';
        
        modal.classList.add('show');
        
        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeNotesModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Close on outside click
        const handleOutsideClick = (e) => {
            if (e.target === modal) {
                this.closeNotesModal();
                modal.removeEventListener('click', handleOutsideClick);
            }
        };
        modal.addEventListener('click', handleOutsideClick);
    }
    
    closeNotesModal() {
        const modal = document.getElementById('notesModal');
        modal.classList.remove('show');
    }
    
    removeToast(toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Global functions for HTML onclick handlers
function showNotesModal(company, role, note) {
    if (window.jobTracker) {
        window.jobTracker.showNotesModal(company, role, note);
    }
}

function closeNotesModal() {
    if (window.jobTracker) {
        window.jobTracker.closeNotesModal();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.jobTracker = new JobTracker();
    window.jobTracker.init();
});

// Update last sync time every minute
setInterval(() => {
    const jobTracker = window.jobTracker;
    if (jobTracker) {
        jobTracker.updateLastSyncDisplay();
    }
}, 60000);
