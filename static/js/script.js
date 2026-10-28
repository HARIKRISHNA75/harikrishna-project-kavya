const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const $ = id => document.getElementById(id);
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

const filesInput = $("files");
const drop = $("drop");
const languageSelect = $("language");
const documentSelect = $("document");
const uploadButton = $("upload-btn");
const queryButton = $("query-btn");
let indexReady = false;

function setMsg(element, text, kind = "") {
    element.textContent = text;
    element.className = `msg ${kind}`.trim();
}

function formatSize(bytes) {
    return bytes < 1024 * 1024
        ? `${(bytes / 1024).toFixed(0)} KB`
        : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function readApiResponse(response) {
    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error("The document service returned an invalid response. Please try again.");
    }

    if (!response.ok) {
        throw new Error(data.error || `The document service is unavailable (HTTP ${response.status}).`);
    }
    return data;
}

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function renderMarkdown(markdown) {
    const inline = text => escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>");
    const output = [];
    let list = "";
    const closeList = () => {
        if (list) {
            output.push(`</${list}>`);
            list = "";
        }
    };

    for (const rawLine of markdown.split("\n")) {
        const line = rawLine.trim();
        let match;
        if (!line) {
            closeList();
        } else if ((match = line.match(/^#{1,6}\s+(.*)$/))) {
            closeList();
            output.push(`<h3>${inline(match[1])}</h3>`);
        } else if ((match = line.match(/^[-*•]\s+(.*)$/))) {
            if (list !== "ul") {
                closeList();
                output.push("<ul>");
                list = "ul";
            }
            output.push(`<li>${inline(match[1])}</li>`);
        } else if ((match = line.match(/^\d+[.)]\s+(.*)$/))) {
            if (list !== "ol") {
                closeList();
                output.push("<ol>");
                list = "ol";
            }
            output.push(`<li>${inline(match[1])}</li>`);
        } else {
            closeList();
            output.push(`<p>${inline(line)}</p>`);
        }
    }
    closeList();
    return output.join("");
}

function renderFileList() {
    const list = $("file-list");
    list.replaceChildren();

    for (const file of filesInput.files) {
        const item = document.createElement("li");
        const name = document.createElement("span");
        const size = document.createElement("span");
        name.textContent = file.name;
        size.textContent = formatSize(file.size);
        item.append(name, size);
        list.append(item);
    }
}

async function refreshStatus() {
    try {
        const data = await readApiResponse(await fetch("/status"));
        const status = $("status");
        indexReady = Boolean(data.ready);

        if (data.ready) {
            status.textContent = `${data.documents.length} document(s) indexed · ${data.num_chunks} chunks`;
            status.classList.add("ready");
            emit("rag:indexed", { count: data.documents.length });
        } else {
            status.textContent = "No documents indexed yet";
            status.classList.remove("ready");
        }

        const currentDocumentId = documentSelect.value;
        documentSelect.replaceChildren(new Option("All documents", ""));
        for (const item of data.documents || []) {
            documentSelect.add(new Option(item.label, item.id));
        }
        if ([...documentSelect.options].some(option => option.value === currentDocumentId)) {
            documentSelect.value = currentDocumentId;
        }
    } catch {
        indexReady = false;
        $("status").textContent = "Status unavailable";
        $("status").classList.remove("ready");
    }
}

filesInput.addEventListener("change", renderFileList);

["dragenter", "dragover"].forEach(eventName => {
    drop.addEventListener(eventName, event => {
        event.preventDefault();
        drop.classList.add("over");
    });
});

["dragleave", "drop"].forEach(eventName => {
    drop.addEventListener(eventName, event => {
        event.preventDefault();
        drop.classList.remove("over");
    });
});

drop.addEventListener("drop", event => {
    const transfer = new DataTransfer();
    for (const file of event.dataTransfer.files) {
        transfer.items.add(file);
    }
    filesInput.files = transfer.files;
    filesInput.dispatchEvent(new Event("change", { bubbles: true }));
});

languageSelect.addEventListener("change", () => {
    $("custom-wrap").hidden = languageSelect.value !== "other";
});

$("upload-form").addEventListener("submit", async event => {
    event.preventDefault();
    const message = $("upload-msg");
    const files = [...filesInput.files];
    if (!files.length) {
        setMsg(message, "Please choose at least one file.", "error");
        return;
    }

    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalBytes > MAX_UPLOAD_BYTES) {
        setMsg(message, `Files total ${formatSize(totalBytes)}; the limit is 5 MB per upload.`, "error");
        return;
    }

    const body = new FormData();
    files.forEach(file => body.append("files", file));
    uploadButton.disabled = true;
    setMsg(message, "Extracting and indexing…");
    emit("rag:upload-start");

    try {
        const data = await readApiResponse(await fetch("/upload", { method: "POST", body }));
        setMsg(message, `${data.message} ${data.chunks} chunks created.`, "ok");
        filesInput.value = "";
        renderFileList();
        await refreshStatus();
    } catch (error) {
        setMsg(message, error.message, "error");
    } finally {
        uploadButton.disabled = false;
        emit("rag:upload-end");
    }
});

$("query-form").addEventListener("submit", async event => {
    event.preventDefault();
    const message = $("query-msg");
    const answer = $("answer");
    const question = $("question").value.trim();
    if (!question) {
        setMsg(message, "Please enter a question.", "error");
        return;
    }

    const customLanguage = $("custom-language").value.trim();
    if (languageSelect.value === "other" && !customLanguage) {
        setMsg(message, "Please enter the answer language.", "error");
        $("custom-language").focus();
        return;
    }

    queryButton.disabled = true;
    setMsg(message, "Retrieving and generating answer…");
    emit("rag:query-start");

    try {
        const data = await readApiResponse(await fetch("/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question,
                language: languageSelect.value,
                custom_language: customLanguage,
                document_id: documentSelect.value
            })
        }));
        answer.classList.remove("empty");
        answer.innerHTML = renderMarkdown(data.answer);
        setMsg(message, "");
    } catch (error) {
        setMsg(message, error.message, "error");
    } finally {
        queryButton.disabled = false;
        emit("rag:query-end");
    }
});

refreshStatus();
