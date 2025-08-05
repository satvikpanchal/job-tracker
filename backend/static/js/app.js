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
        
        this.init();
    }
    
    init() {
        console.log("🚀 Initializing JobTracker...");
        this.setupEventListeners();
        this.setupTheme();
        this.setupResponsive();
        this.loadJobs();
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
}

// Global functions for modal interactions
function closeNotesModal() {
    document.getElementById('notesModal').classList.remove('show');
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.jobTracker = new JobTracker();
});
