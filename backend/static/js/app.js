// Job Tracker Application JavaScript
class JobTracker {
    constructor() {
        this.allJobs = [];
        this.filteredJobs = [];
        this.selectedJobs = new Set();
        this.currentPage = 1;
        this.pageSize = 10;
        this.isUpdating = false;
        this.lastSyncTime = localStorage.getItem('lastSyncTime');
        this.selectedSLMModel = null; // Track selected SLM model
        
        this.init();
    }
    
    init() {
        console.log("🚀 Initializing JobTracker...");
        this.setupEventListeners();
        this.setupTheme();
        this.setupResponsive();
        this.loadJobs();
        
        // Check if classifier elements exist before calling
        const statusElement = document.getElementById('classifierStatus');
        const typeElement = document.getElementById('classifierType');
        console.log('🔍 Classifier elements found:', { statusElement, typeElement });
        
        if (statusElement && typeElement) {
            this.checkClassifierStatus(); // Check classifier status on init
        } else {
            console.warn('⚠️ Classifier elements not found during init');
        }
        
        console.log("✅ JobTracker initialization complete");
    }
    
    setupEventListeners() {
        console.log("🔧 Setting up event listeners...");
        
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        console.log("🎨 Theme toggle button found:", themeToggle);
        
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                console.log("🖱️ Theme toggle button clicked!");
                this.toggleTheme();
            });
            console.log("✅ Theme toggle event listener attached");
        } else {
            console.log("❌ Theme toggle button not found!");
        }
        
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
        console.log("🎨 Setting up theme...");
        
        // Get saved theme or default to light mode
        const savedTheme = localStorage.getItem('theme');
        
        console.log("💾 Saved theme:", savedTheme);
        
        // Default to light mode if no theme is saved
        const theme = savedTheme || 'light';
        console.log("🎯 Final theme:", theme);
        
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeIcon();
        
        // Listen for system theme changes (only if no theme is saved)
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                this.updateThemeIcon();
            }
        });
    }
    
    toggleTheme() {
        console.log("🔄 Toggling theme...");
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        console.log("📊 Current theme:", currentTheme);
        console.log("🆕 New theme:", newTheme);
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon();
        
        // Debug: Check if the attribute was actually set
        const actualTheme = document.documentElement.getAttribute('data-theme');
        console.log("✅ Actual theme attribute after setting:", actualTheme);
        
        // Debug: Check if CSS variables are changing
        const computedStyle = getComputedStyle(document.documentElement);
        const bgColor = computedStyle.getPropertyValue('--bg');
        const textColor = computedStyle.getPropertyValue('--text');
        console.log("🎨 CSS Variables - Background:", bgColor, "Text:", textColor);
        
        console.log("✅ Theme updated to:", newTheme);
    }
    
    updateThemeIcon() {
        const themeIcon = document.getElementById('themeIcon');
        const currentTheme = document.documentElement.getAttribute('data-theme');
        
        console.log("🎨 Updating theme icon. Current theme:", currentTheme);
        console.log("🔍 Theme icon element:", themeIcon);
        
        if (themeIcon) {
            const newIconClass = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            themeIcon.className = newIconClass;
            console.log("✅ Icon updated to:", newIconClass);
        } else {
            console.log("❌ Theme icon element not found!");
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
        console.log("📥 Loading jobs from API...");
        // Load jobs from the API instead of HTML
        fetch('/api/jobs')
            .then(response => response.json())
            .then(jobs => {
                console.log("📥 Received jobs data:", jobs.length, "jobs");
                this.allJobs = jobs;
                this.filteredJobs = [...this.allJobs];
                this.currentPage = 1;
                this.renderTable();
                console.log("✅ Jobs loaded and table rendered");
            })
            .catch(error => {
                console.error("❌ Error loading jobs:", error);
                this.showToast('Failed to load jobs', 'error');
            });
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
        
        // Show/hide table container and empty state based on whether we have jobs
        const tableContainer = document.querySelector('.table-container');
        const emptyState = document.querySelector('.empty-state');
        const bulkActions = document.getElementById('bulkActions');
        const paginationContainer = document.querySelector('.pagination-container');
        
        if (this.allJobs.length === 0) {
            // No jobs - show empty state, hide table
            if (tableContainer) tableContainer.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            if (bulkActions) bulkActions.style.display = 'none';
            if (paginationContainer) paginationContainer.style.display = 'none';
            return;
        } else {
            // Have jobs - show table, hide empty state
            if (tableContainer) tableContainer.style.display = 'block';
            if (emptyState) emptyState.style.display = 'none';
            if (paginationContainer) paginationContainer.style.display = 'flex';
        }
        
        // Rebuild table body with current data
        const tableBody = document.getElementById('jobsTableBody');
        if (tableBody) {
            tableBody.innerHTML = '';
            
            pageJobs.forEach(job => {
                const row = document.createElement('tr');
                row.dataset.jobId = job.id;
                row.dataset.status = job.status;
                
                // Create status badge HTML
                const statusBadge = this.getStatusBadgeHtml(job.status);
                
                // Create notes display
                const notesDisplay = job.note ? 
                    `<span class="note-text">${job.note.length > 20 ? job.note.substring(0, 20) + '...' : job.note}</span>` : 
                    '—';
                
                row.innerHTML = `
                    <td>
                        <input type="checkbox" class="job-checkbox" value="${job.id}">
                    </td>
                    <td class="company-cell">
                        <div class="company-name">${job.company}</div>
                    </td>
                    <td class="role-cell">${job.role}</td>
                    <td class="status-cell">
                        ${statusBadge}
                    </td>
                    <td class="date-cell">${job.applied_date || 'N/A'}</td>
                    <td class="date-cell">${job.last_update || 'N/A'}</td>
                    <td class="notes-cell" data-company="${job.company}" data-role="${job.role}" data-note="${job.note || ''}">
                        ${notesDisplay}
                    </td>
                    <td class="actions-cell">
                        <button class="btn btn-ghost btn-sm update-btn" data-job-id="${job.id}" data-company="${job.company}" data-role="${job.role}" data-status="${job.status}" aria-label="Update ${job.company}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm btn-danger delete-btn" data-job-id="${job.id}" data-company="${job.company}" aria-label="Delete ${job.company}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Reattach event listeners
            this.attachRowEventListeners();
        }
        
        // Update mobile cards
        this.renderMobileCards(pageJobs);
        
        this.updatePaginationInfo();
        this.updatePaginationButtons();
    }
    
    getStatusBadgeHtml(status) {
        const statusConfig = {
            'applied': { icon: 'fa-paper-plane', text: 'Applied', class: 'status-applied' },
            'interview': { icon: 'fa-calendar-alt', text: 'Interview', class: 'status-interview' },
            'offer': { icon: 'fa-trophy', text: 'Offer', class: 'status-offer' },
            'rejected': { icon: 'fa-times-circle', text: 'Rejected', class: 'status-rejected' }
        };
        
        const config = statusConfig[status] || statusConfig['applied'];
        return `<span class="status-badge ${config.class}">
            <i class="fas ${config.icon}"></i> ${config.text}
        </span>`;
    }
    
    renderMobileCards(jobs) {
        const mobileCardsContainer = document.getElementById('mobileCards');
        if (mobileCardsContainer) {
            mobileCardsContainer.innerHTML = '';
            
            jobs.forEach(job => {
                const card = document.createElement('div');
                card.className = 'job-card';
                card.dataset.jobId = job.id;
                card.dataset.status = job.status;
                
                const statusBadge = this.getStatusBadgeHtml(job.status);
                
                card.innerHTML = `
                    <div class="job-card-header">
                        <h3>${job.company}</h3>
                        ${statusBadge}
                    </div>
                    <div class="job-card-body">
                        <div class="job-role">${job.role}</div>
                        <div class="job-dates">
                            <span>Applied: ${job.applied_date || 'N/A'}</span>
                            <span>Updated: ${job.last_update || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="job-card-actions">
                        <button class="btn btn-ghost btn-sm update-btn" data-job-id="${job.id}" data-company="${job.company}" data-role="${job.role}" data-status="${job.status}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm btn-danger delete-btn" data-job-id="${job.id}" data-company="${job.company}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                mobileCardsContainer.appendChild(card);
            });
        }
    }
    
    attachRowEventListeners() {
        // Reattach checkbox listeners
        document.querySelectorAll('.job-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleJobSelect(e.target));
        });
        
        // Reattach update button listeners
        document.querySelectorAll('.update-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const jobId = e.target.closest('button').dataset.jobId;
                const company = e.target.closest('button').dataset.company;
                const role = e.target.closest('button').dataset.role;
                const status = e.target.closest('button').dataset.status;
                this.showUpdateModal({ id: jobId, company, role, status });
            });
        });
        
        // Reattach delete button listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const jobId = e.target.closest('button').dataset.jobId;
                const company = e.target.closest('button').dataset.company;
                this.showDeleteConfirm(jobId, company);
            });
        });
        
        // Reattach notes cell listeners
        document.querySelectorAll('.notes-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const company = e.target.dataset.company;
                const role = e.target.dataset.role;
                const note = e.target.dataset.note;
                this.showNotesModal(company, role, note);
            });
        });
    }
    
    updatePaginationInfo() {
        const totalJobs = this.filteredJobs.length;
        const startIndex = (this.currentPage - 1) * this.pageSize + 1;
        const endIndex = Math.min(this.currentPage * this.pageSize, totalJobs);
        
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo) {
            paginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${totalJobs} jobs`;
        }
    }
    
    updatePaginationButtons() {
        const totalPages = Math.ceil(this.filteredJobs.length / this.pageSize);
        
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const pageNumbers = document.getElementById('pageNumbers');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
        
        if (pageNumbers) {
            pageNumbers.textContent = `${this.currentPage} of ${totalPages}`;
        }
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
        const checkboxes = document.querySelectorAll('.job-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            if (checked) {
                this.selectedJobs.add(checkbox.value);
            } else {
                this.selectedJobs.delete(checkbox.value);
            }
        });
        this.updateBulkActions();
    }
    
    handleJobSelect(checkbox) {
        if (checkbox.checked) {
            this.selectedJobs.add(checkbox.value);
        } else {
            this.selectedJobs.delete(checkbox.value);
        }
        this.updateBulkActions();
        this.updateSelectAllState();
    }
    
    updateSelectAllState() {
        const selectAllCheckbox = document.getElementById('selectAll');
        const jobCheckboxes = document.querySelectorAll('.job-checkbox');
        const visibleCheckboxes = Array.from(jobCheckboxes).filter(cb => cb.closest('tr').style.display !== 'none');
        const checkedCount = visibleCheckboxes.filter(cb => cb.checked).length;
        
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = checkedCount === visibleCheckboxes.length && visibleCheckboxes.length > 0;
            selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < visibleCheckboxes.length;
        }
    }
    
    updateBulkActions() {
        const bulkActions = document.getElementById('bulkActions');
        const selectedCount = document.getElementById('selectedCount');
        
        if (this.selectedJobs.size > 0) {
            bulkActions.style.display = 'block';
            selectedCount.textContent = `${this.selectedJobs.size} selected`;
        } else {
            bulkActions.style.display = 'none';
        }
    }
    
    toggleDropdown(menu) {
        menu.classList.toggle('show');
    }
    
    showUpdateModal(data) {
        const modal = document.getElementById('updateModal');
        const companyName = document.querySelector('.modal-company-name');
        const positionName = document.querySelector('.modal-position-name');
        const jobIdInput = document.getElementById('updateJobId');
        
        if (companyName) companyName.textContent = data.company;
        if (positionName) positionName.textContent = data.role;
        if (jobIdInput) jobIdInput.value = data.jobId;
        
        // Set current status
        const statusRadio = document.querySelector(`input[name="status"][value="${data.status}"]`);
        if (statusRadio) statusRadio.checked = true;
        
        // Set current date
        const dateInput = document.getElementById('updateDate');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        
        modal.classList.add('show');
    }
    
    handleUpdateSubmit() {
        const form = document.getElementById('updateForm');
        const formData = new FormData(form);
        const jobId = document.getElementById('updateJobId').value;
        
        // Here you would typically send the data to your backend
        console.log('Updating job:', jobId, Object.fromEntries(formData));
        
        this.closeModal();
        this.showToast('Job updated successfully!', 'success');
    }
    
    showDeleteConfirm(jobId, company) {
        if (confirm(`Are you sure you want to delete the job application for ${company}?`)) {
            // Here you would typically send the delete request to your backend
            console.log('Deleting job:', jobId);
            this.showToast('Job deleted successfully!', 'success');
        }
    }
    
    showBulkUpdateModal() {
        if (this.selectedJobs.size === 0) {
            this.showToast('Please select jobs to update', 'warning');
            return;
        }
        
        // Create a better modal interface for bulk updates
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Bulk Update ${this.selectedJobs.size} Jobs</h3>
                    <button class="btn btn-ghost modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Update Status</label>
                        <div class="status-options">
                            <label class="status-option">
                                <input type="radio" name="bulkStatus" value="applied">
                                <span class="status-badge status-applied">
                                    <i class="fas fa-paper-plane"></i> Applied
                                </span>
                            </label>
                            <label class="status-option">
                                <input type="radio" name="bulkStatus" value="interview">
                                <span class="status-badge status-interview">
                                    <i class="fas fa-calendar-alt"></i> Interview
                                </span>
                            </label>
                            <label class="status-option">
                                <input type="radio" name="bulkStatus" value="offer">
                                <span class="status-badge status-offer">
                                    <i class="fas fa-trophy"></i> Offer
                                </span>
                            </label>
                            <label class="status-option">
                                <input type="radio" name="bulkStatus" value="rejected">
                                <span class="status-badge status-rejected">
                                    <i class="fas fa-times-circle"></i> Rejected
                                </span>
                            </label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="bulkNote">Add Note (optional)</label>
                        <textarea id="bulkNote" placeholder="Add a note to all selected jobs..." rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="bulkDate">Update Date</label>
                        <input type="date" id="bulkDate" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-outline" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="window.jobTracker.executeBulkUpdate(this.closest('.modal'))">Update All</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    executeBulkUpdate(modal) {
        const statusRadio = modal.querySelector('input[name="bulkStatus"]:checked');
        const note = modal.querySelector('#bulkNote').value;
        const date = modal.querySelector('#bulkDate').value;
        
        if (!statusRadio) {
            this.showToast('Please select a status', 'warning');
            return;
        }
        
        const updateData = {
            status: statusRadio.value,
            note: note,
            date: date,
            jobIds: Array.from(this.selectedJobs)
        };
        
        console.log('Bulk updating jobs:', updateData);
        this.showToast(`Updated ${this.selectedJobs.size} jobs to ${statusRadio.value}`, 'success');
        
        // Clear selections and close modal
        this.selectedJobs.clear();
        this.updateBulkActions();
        this.updateSelectAllState();
        modal.remove();
    }
    
    showBulkDeleteConfirm() {
        if (this.selectedJobs.size === 0) {
            this.showToast('Please select jobs to delete', 'warning');
            return;
        }
        
        if (confirm(`Are you sure you want to delete ${this.selectedJobs.size} selected job applications?`)) {
            console.log('Bulk deleting jobs:', Array.from(this.selectedJobs));
            this.showToast(`Deleted ${this.selectedJobs.size} jobs`, 'success');
            this.selectedJobs.clear();
            this.updateBulkActions();
            this.updateSelectAllState();
        }
    }
    
    showNotesModal(company, role, note) {
        const notesModal = document.getElementById('notesModal');
        const companyElement = document.getElementById('notesModalCompany');
        const roleElement = document.getElementById('notesModalRole');
        const noteElement = document.getElementById('notesModalNote');
        
        if (companyElement) companyElement.textContent = company;
        if (roleElement) roleElement.textContent = role;
        if (noteElement) noteElement.textContent = note || 'No notes available';
        
        notesModal.classList.add('show');
    }
    
    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
        document.querySelectorAll('.notes-modal').forEach(modal => {
            modal.classList.remove('show');
        });
    }
    
    syncEmails() {
        const progressModal = document.getElementById('progressModal');
        const progressFill = document.getElementById('progressFill');
        const progressMessage = document.getElementById('progressMessage');
        
        progressModal.classList.add('show');
        progressMessage.textContent = 'Connecting to Gmail...';
        progressFill.style.width = '0%';
        
        // Create EventSource for real-time sync progress
        const eventSource = new EventSource('/sync-stream');
        
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Sync event:', data);
                
                switch (data.status) {
                    case 'starting':
                        progressMessage.textContent = data.message;
                        progressFill.style.width = '10%';
                        break;
                        
                    case 'processing':
                        progressMessage.textContent = data.message;
                        progressFill.style.width = '50%';
                        break;
                        
                    case 'complete':
                        progressMessage.textContent = data.message;
                        progressFill.style.width = '100%';
                        eventSource.close();
                        setTimeout(() => {
                            progressModal.classList.remove('show');
                            this.showToast('Emails synced successfully!', 'success');
                            // Fetch fresh data from the API
                            this.refreshJobsData();
                        }, 1000);
                        break;
                        
                    case 'error':
                        progressMessage.textContent = data.message;
                        eventSource.close();
                        setTimeout(() => {
                            progressModal.classList.remove('show');
                            this.showToast('Sync failed: ' + data.message, 'error');
                        }, 2000);
                        break;
                }
            } catch (error) {
                console.error('Error parsing sync event:', error);
                eventSource.close();
                setTimeout(() => {
                    progressModal.classList.remove('show');
                    this.showToast('Sync failed: Invalid response', 'error');
                }, 2000);
            }
        };
        
        eventSource.onerror = (error) => {
            console.error('EventSource error:', error);
            eventSource.close();
            setTimeout(() => {
                progressModal.classList.remove('show');
                this.showToast('Sync failed: Connection error', 'error');
            }, 2000);
        };
    }
    
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
    
    // Classifier methods
    async checkClassifierStatus() {
        try {
            console.log('🔍 Checking classifier status...');
            console.log('📡 Making request to /classifier/status...');
            const response = await fetch('/classifier/status');
            console.log('📡 Response received:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📊 Response data:', data);
            
            const statusElement = document.getElementById('classifierStatus');
            const typeElement = document.getElementById('classifierType');
            
            if (!statusElement || !typeElement) {
                console.error('❌ DOM elements not found:', { statusElement, typeElement });
                return;
            }
            
            if (data.success) {
                typeElement.textContent = data.classifier_type.toUpperCase();
                
                if (data.classifier_type === 'slm') {
                    const status = data.status;
                    if (status.ollama_running) {
                        statusElement.innerHTML = `
                            <span class="status-indicator status-success">
                                <i class="fas fa-check-circle"></i>
                                SLM Running (${status.current_model})
                            </span>
                        `;
                        console.log('✅ SLM status updated successfully');
                    } else {
                        statusElement.innerHTML = `
                            <span class="status-indicator status-error">
                                <i class="fas fa-times-circle"></i>
                                SLM Not Running
                            </span>
                        `;
                        console.log('❌ SLM not running');
                    }
                } else {
                    statusElement.innerHTML = `
                        <span class="status-indicator status-success">
                            <i class="fas fa-check-circle"></i>
                            Gemini Active
                        </span>
                    `;
                    console.log('✅ Gemini status updated successfully');
                }
            } else {
                statusElement.innerHTML = `
                    <span class="status-indicator status-error">
                        <i class="fas fa-exclamation-triangle"></i>
                        ${data.message}
                    </span>
                `;
                typeElement.textContent = 'ERROR';
                console.log('❌ Backend returned error:', data.message);
            }
        } catch (error) {
            console.error('❌ Error checking classifier status:', error);
            
            // Try to get the status element
            const statusElement = document.getElementById('classifierStatus');
            if (statusElement) {
                statusElement.innerHTML = `
                    <span class="status-indicator status-error">
                        <i class="fas fa-exclamation-triangle"></i>
                        Error: ${error.message}
                    </span>
                `;
            } else {
                console.error('❌ Could not find status element to update');
            }
        }
    }
    
    async switchClassifier() {
        console.log('🔄 Switch classifier called...');
        this.openClassifierModal();
    }
    
    openClassifierModal() {
        console.log('🔍 Opening classifier modal...');
        const modal = document.getElementById('classifierModal');
        if (modal) {
            modal.classList.add('show');
            this.populateClassifierModal();
            this.setupClassifierModalEvents();
        } else {
            console.error('❌ Classifier modal not found');
        }
    }
    
    setupClassifierModalEvents() {
        // Make classifier options clickable
        document.querySelectorAll('.classifier-option').forEach(option => {
            option.addEventListener('click', () => {
                this.selectClassifierOption(option.dataset.type);
            });
        });
    }
    
    async populateClassifierModal() {
        console.log('📊 Populating classifier modal...');
        
        try {
            // Get current classifier status
            const response = await fetch('/classifier/status');
            const data = await response.json();
            console.log('📡 Modal data received:', data);
            
            if (data.success) {
                const currentType = data.classifier_type;
                console.log('🎯 Current classifier type:', currentType);
                
                // Update SLM details
                if (data.classifier_type === 'slm' && data.status) {
                    console.log('🤖 Updating SLM details:', data.status);
                    const slmModel = document.getElementById('slmModel');
                    const slmUrl = document.getElementById('slmUrl');
                    const slmModels = document.getElementById('slmModels');
                    const slmStatus = document.getElementById('slmStatus');
                    const slmModelSelect = document.getElementById('slmModelSelect');
                    
                    if (slmUrl) slmUrl.textContent = data.status.base_url;
                    if (slmModels) slmModels.textContent = data.status.available_models.join(', ');
                    
                    // Populate model selection dropdown
                    if (slmModelSelect) {
                        this.populateModelDropdown(slmModelSelect, data.status.available_models, data.status.current_model);
                    }
                    
                    if (data.status.ollama_running) {
                        if (slmStatus) {
                            slmStatus.textContent = 'Running';
                            slmStatus.className = 'status-badge status-success';
                        }
                    } else {
                        if (slmStatus) {
                            slmStatus.textContent = 'Not Running';
                            slmStatus.className = 'status-badge status-error';
                        }
                    }
                }
                
                // Update Gemini details
                const geminiStatus = document.getElementById('geminiStatus');
                if (geminiStatus) {
                    if (currentType === 'gemini') {
                        geminiStatus.textContent = 'Active';
                        geminiStatus.className = 'status-badge status-success';
                    } else {
                        geminiStatus.textContent = 'Available';
                        geminiStatus.className = 'status-badge status-info';
                    }
                }
                
                // Mark current classifier as selected
                this.selectClassifierOption(currentType);
                console.log('✅ Modal populated successfully');
                
            } else {
                console.error('❌ Failed to get classifier status:', data.message);
            }
            
        } catch (error) {
            console.error('❌ Error populating modal:', error);
        }
    }
    
    selectClassifierOption(classifierType) {
        console.log('🎯 Selecting classifier:', classifierType);
        
        // Remove previous selection
        document.querySelectorAll('.classifier-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Select current classifier
        const currentOption = document.querySelector(`[data-type="${classifierType}"]`);
        if (currentOption) {
            currentOption.classList.add('selected');
            console.log('✅ Selected option:', classifierType);
        } else {
            console.error('❌ Could not find option for:', classifierType);
        }
    }
    
    async applyClassifierSelection() {
        const selectedOption = document.querySelector('.classifier-option.selected');
        if (!selectedOption) {
            alert('Please select a classifier first');
            return;
        }
        
        const newType = selectedOption.dataset.type;
        const currentType = document.getElementById('classifierType').textContent.toLowerCase();
        
        if (newType === currentType) {
            alert('This classifier is already active');
            return;
        }
        
        // If switching to SLM, include the selected model
        let requestBody = { classifier_type: newType };
        if (newType === 'slm' && this.selectedSLMModel) {
            requestBody.model_name = this.selectedSLMModel;
            console.log('🤖 Switching to SLM with model:', this.selectedSLMModel);
        }
        
        if (confirm(`Switch from ${currentType.toUpperCase()} to ${newType.toUpperCase()}? You'll need to restart the application to apply changes.`)) {
            try {
                const response = await fetch('/classifier/switch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });
                
                const data = await response.json();
                if (data.success) {
                    alert(data.message);
                    this.closeClassifierModal();
                    this.checkClassifierStatus();
                } else {
                    alert('Error: ' + data.message);
                }
            } catch (error) {
                console.error('Error switching classifier:', error);
                alert('Error switching classifier');
            }
        }
    }
    
    closeClassifierModal() {
        const modal = document.getElementById('classifierModal');
        if (modal) {
            modal.classList.remove('show');
        }
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
    
    refreshJobsData() {
        console.log("🔄 Refreshing jobs data from API...");
        fetch('/api/jobs')
            .then(response => response.json())
            .then(jobs => {
                console.log("📥 Received fresh jobs data:", jobs.length, "jobs");
                this.allJobs = jobs;
                this.filteredJobs = [...this.allJobs];
                this.currentPage = 1;
                this.renderTable();
                this.showToast(`Refreshed data: ${jobs.length} jobs loaded`, 'success');
            })
            .catch(error => {
                console.error("❌ Error refreshing jobs data:", error);
                this.showToast('Failed to refresh data', 'error');
            });
    }

    populateModelDropdown(selectElement, availableModels, currentModel) {
        console.log('📋 Populating model dropdown with:', availableModels, 'current:', currentModel);
        
        // Clear existing options
        selectElement.innerHTML = '';
        
        // Group models by type for better organization
        const modelGroups = this.groupModelsByType(availableModels);
        
        // Add grouped models to dropdown
        Object.entries(modelGroups).forEach(([groupName, models]) => {
            // Add group header
            const groupOption = document.createElement('option');
            groupOption.value = '';
            groupOption.textContent = `── ${groupName} ──`;
            groupOption.disabled = true;
            selectElement.appendChild(groupOption);
            
            // Add models in this group
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = this.getModelDisplayName(model);
                
                // Mark current model as selected
                if (model === currentModel) {
                    option.selected = true;
                    this.selectedSLMModel = currentModel;
                    this.updateModelSelectionUI(currentModel);
                }
                
                selectElement.appendChild(option);
            });
        });
        
        // Add change event listener
        selectElement.addEventListener('change', (e) => {
            const selectedModel = e.target.value;
            if (selectedModel) { // Only update if a valid model is selected
                console.log('🔄 Model selection changed to:', selectedModel);
                this.updateSelectedModel(selectedModel);
            }
        });
        
        console.log('✅ Model dropdown populated with', availableModels.length, 'models');
    }
    
    groupModelsByType(models) {
        const groups = {};
        
        models.forEach(model => {
            let groupName = 'Other';
            
            if (model.includes('mistral')) {
                groupName = 'Mistral Models';
            } else if (model.includes('llama') || model.includes('codellama')) {
                groupName = 'Llama Models';
            } else if (model.includes('gemma')) {
                groupName = 'Gemma Models';
            } else if (model.includes('gpt')) {
                groupName = 'GPT Models';
            }
            
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(model);
        });
        
        return groups;
    }
    
    getModelDisplayName(model) {
        // Make model names more readable
        return model
            .replace('mistral:', 'Mistral ')
            .replace('llama2:', 'Llama2 ')
            .replace('codellama:', 'CodeLlama ')
            .replace('gemma3:', 'Gemma3 ')
            .replace('gpt-oss:', 'GPT-OSS ')
            .replace('-q4_K_M', ' (Quantized)')
            .replace('-instruct', ' (Instruct)');
    }
    
    updateSelectedModel(modelName) {
        console.log('🔄 Updating selected model to:', modelName);
        // Store the selected model for when applying the selection
        this.selectedSLMModel = modelName;
        
        // Update the UI to show the selected model
        this.updateModelSelectionUI(modelName);
    }
    
    updateModelSelectionUI(modelName) {
        // Update the current model display
        const currentModelDisplay = document.getElementById('currentModelDisplay');
        if (currentModelDisplay) {
            currentModelDisplay.textContent = `Currently: ${modelName}`;
        }
    }
}

// Global functions for modal interactions
function closeNotesModal() {
    document.getElementById('notesModal').classList.remove('show');
}

// Global functions for classifier controls
function checkClassifierStatus() {
    if (window.jobTracker) {
        window.jobTracker.checkClassifierStatus();
    }
}

function switchClassifier() {
    if (window.jobTracker) {
        window.jobTracker.switchClassifier();
    }
}

function closeClassifierModal() {
    if (window.jobTracker) {
        window.jobTracker.closeClassifierModal();
    }
}

function applyClassifierSelection() {
    if (window.jobTracker) {
        window.jobTracker.applyClassifierSelection();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.jobTracker = new JobTracker();
});
